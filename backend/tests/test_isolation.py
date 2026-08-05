"""Tenant-isolation and data-exposure regression tests (P0).

Covers the four live exposure bugs:
  * cross-tenant read of buyer quotations
  * internal cost/margin fields reaching a buyer at any nesting depth
  * cross-tenant file download
  * quotation submitted against an RFQ the exporter was never invited to
"""
import io
import uuid

import pytest

from conftest import make_rfq

INTERNAL_FIELDS = ("internal_costs", "internal_notes")


def find_key(node, keys, path="$"):
    """Return the path to the first occurrence of any key in ``keys``, at any depth."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k in keys:
                return f"{path}.{k}"
            hit = find_key(v, keys, f"{path}.{k}")
            if hit:
                return hit
    elif isinstance(node, list):
        for i, v in enumerate(node):
            hit = find_key(v, keys, f"{path}[{i}]")
            if hit:
                return hit
    return None


@pytest.fixture(scope="module")
def owned_rfq(backend, buyer):
    return make_rfq(backend, buyer.company_id)


@pytest.fixture(scope="module")
def published_quotation(backend, admin, owned_rfq):
    """A published buyer quotation carrying internal costs, on the buyer's own RFQ."""
    r = admin.post("/api/admin/buyer-quotations", json={
        "rfq_id": owned_rfq,
        "total_price": 3400.0,
        "currency": "USD",
        "quantity": "500",
        "lead_time": "30 days",
        "payment_schedule": [{"label": "30% deposit", "percent": 30, "trigger": "confirm", "status": "not_due"}],
        "internal_costs": {"exporter_cost": 6.80, "margin_pct": 25},
        "internal_notes": "SECRET_MARGIN_25",
    })
    assert r.status_code == 200, r.text
    bqid = r.json()["buyer_quotation_id"]
    assert admin.patch(f"/api/admin/buyer-quotations/{bqid}", json={"status": "published"}).status_code == 200
    return bqid


class TestQuotationIsolation:
    def test_admin_still_sees_internal_costs(self, admin, owned_rfq, published_quotation):
        docs = admin.get(f"/api/buyer-quotations?rfq_id={owned_rfq}").json()
        doc = next(d for d in docs if d["buyer_quotation_id"] == published_quotation)
        assert doc["internal_notes"] == "SECRET_MARGIN_25"
        assert doc["internal_costs"]["margin_pct"] == 25

    def test_buyer_sees_own_published_quotation_without_internals(self, buyer, published_quotation):
        r = buyer.get("/api/buyer-quotations")
        assert r.status_code == 200, r.text
        docs = r.json()
        assert any(d["buyer_quotation_id"] == published_quotation for d in docs)
        leak = find_key(docs, INTERNAL_FIELDS)
        assert leak is None, f"internal field leaked to buyer at {leak}"

    def test_other_buyer_cannot_see_the_quotation(self, other_buyer, published_quotation):
        docs = other_buyer.get("/api/buyer-quotations").json()
        assert not any(d["buyer_quotation_id"] == published_quotation for d in docs)

    def test_other_buyer_cannot_target_it_by_rfq_id(self, other_buyer, owned_rfq, published_quotation):
        """Passing someone else's rfq_id must not widen what a buyer can read."""
        docs = other_buyer.get(f"/api/buyer-quotations?rfq_id={owned_rfq}").json()
        assert docs == [], f"cross-tenant read via rfq_id: {docs}"

    def test_draft_quotation_is_not_visible_to_buyer(self, backend, admin, buyer, owned_rfq):
        r = admin.post("/api/admin/buyer-quotations", json={
            "rfq_id": owned_rfq, "total_price": 99.0, "currency": "USD",
            "quantity": "1", "lead_time": "x", "payment_schedule": [],
            "internal_notes": "DRAFT_ONLY",
        })
        draft_id = r.json()["buyer_quotation_id"]
        docs = buyer.get("/api/buyer-quotations").json()
        assert not any(d["buyer_quotation_id"] == draft_id for d in docs), "unpublished draft visible to buyer"

    def test_buyer_is_refused_the_raw_exporter_quotation_route(self, buyer):
        """/api/quotations has no buyer branch — the duplicate was the leak."""
        r = buyer.get("/api/quotations")
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"
        assert find_key(r.json(), INTERNAL_FIELDS) is None

    def test_exporter_sees_only_own_exporter_quotations(self, backend, admin, exporter, other_exporter, owned_rfq):
        backend.store.insert("exporter_invitations", {
            "invitation_id": f"inv_{uuid.uuid4().hex[:8]}", "rfq_id": owned_rfq,
            "exporter_company_id": exporter.company_id, "status": "invited",
        })
        r = exporter.post("/api/quotations", json={
            "rfq_id": owned_rfq, "unit_price": 6.8, "currency": "USD", "quantity": "500",
        })
        assert r.status_code == 200, r.text
        qid = r.json()["quotation_id"]

        mine = exporter.get("/api/quotations").json()
        assert any(q["quotation_id"] == qid for q in mine)
        theirs = other_exporter.get("/api/quotations").json()
        assert not any(q["quotation_id"] == qid for q in theirs), "exporter quote leaked to another exporter"


class TestNoInternalFieldsAnywhere:
    """Walk every endpoint a buyer can reach and assert the internal fields appear nowhere."""

    def test_sweep_all_buyer_reachable_endpoints(self, backend, buyer, owned_rfq, published_quotation, admin):
        order = admin.post("/api/admin/orders", json={
            "rfq_id": owned_rfq, "exporter_company_id": "manual_1", "total_price": 3400.0,
            "currency": "USD",
            "milestones": [{"label": "30% deposit", "percent": 30, "trigger": "confirm",
                            "status": "not_due", "amount": 1020.0}],
        })
        assert order.status_code == 200, order.text
        order_id = order.json()["order_id"]

        paths = [
            "/api/auth/me",
            "/api/rfqs",
            f"/api/rfqs/{owned_rfq}",
            "/api/buyer-quotations",
            f"/api/buyer-quotations?rfq_id={owned_rfq}",
            "/api/orders",
            f"/api/orders/{order_id}",
            "/api/catalogue",
            "/api/demo/sample-order",
            "/api/quotations",
        ]
        for path in paths:
            r = buyer.get(path)
            assert r.status_code in (200, 403, 404), f"{path} -> {r.status_code} {r.text[:120]}"
            if r.status_code != 200:
                continue
            leak = find_key(r.json(), INTERNAL_FIELDS)
            assert leak is None, f"{path} leaked internal field at {leak}"

    def test_admin_only_endpoints_reject_buyers(self, buyer, owned_rfq):
        for path in ["/api/admin/overview", "/api/admin/companies", "/api/admin/users",
                     f"/api/admin/quotations?rfq_id={owned_rfq}"]:
            r = buyer.get(path)
            assert r.status_code == 403, f"{path} -> {r.status_code}"


class TestUninvitedQuotation:
    def test_exporter_cannot_quote_an_rfq_it_was_not_invited_to(self, backend, other_exporter, buyer):
        rfq_id = make_rfq(backend, buyer.company_id, product_name="TEST Uninvited")
        r = other_exporter.post("/api/quotations", json={
            "rfq_id": rfq_id, "unit_price": 1.0, "currency": "USD", "quantity": "10",
        })
        assert r.status_code == 404, f"uninvited exporter got {r.status_code}: {r.text[:200]}"
        assert backend.store.count("exporter_quotations", {"rfq_id": rfq_id}) == 0

    def test_exporter_cannot_read_an_rfq_it_was_not_invited_to(self, backend, other_exporter, buyer):
        rfq_id = make_rfq(backend, buyer.company_id, product_name="TEST Unreadable")
        assert other_exporter.get(f"/api/rfqs/{rfq_id}").status_code == 403

    def test_invited_exporter_never_sees_buyer_contact(self, backend, exporter, buyer):
        rfq_id = make_rfq(
            backend, buyer.company_id,
            contact_name="Jane Buyer", contact_email="jane@buyer.example",
            contact_company="Aria & Co.", contact_country="United States",
        )
        backend.store.insert("exporter_invitations", {
            "invitation_id": f"inv_{uuid.uuid4().hex[:8]}", "rfq_id": rfq_id,
            "exporter_company_id": exporter.company_id, "status": "invited",
        })
        hidden = ("contact_name", "contact_email", "contact_company", "contact_country",
                  "buyer_user_id", "buyer_company_id")

        one = exporter.get(f"/api/rfqs/{rfq_id}")
        assert one.status_code == 200, one.text
        leak = find_key(one.json(), hidden)
        assert leak is None, f"buyer identity leaked to exporter at {leak}"

        listed = exporter.get("/api/rfqs").json()
        assert find_key(listed, hidden) is None, "buyer identity leaked in RFQ list"


class TestFileIsolation:
    @pytest.fixture(scope="class")
    def uploaded(self, backend, buyer, owned_rfq):
        """A file uploaded by the buyer against their own RFQ."""
        r = buyer.post(
            "/api/files/upload",
            files={"file": ("ref.txt", io.BytesIO(b"reference image bytes"), "text/plain")},
            data={"rfq_id": owned_rfq},
        )
        if r.status_code == 503:
            pytest.skip("object storage unreachable in this environment")
        assert r.status_code == 200, r.text
        return r.json()["file_id"]

    def test_owner_can_download(self, buyer, uploaded):
        r = buyer.get(f"/api/files/{uploaded}")
        assert r.status_code == 200, r.text

    def test_admin_can_download(self, admin, uploaded):
        assert admin.get(f"/api/files/{uploaded}").status_code == 200

    def test_other_buyer_gets_404_not_403(self, other_buyer, uploaded):
        """404, not 403 — a 403 would confirm the file id exists."""
        r = other_buyer.get(f"/api/files/{uploaded}")
        assert r.status_code == 404, f"cross-tenant file download returned {r.status_code}"

    def test_uninvited_exporter_cannot_download(self, other_exporter, uploaded):
        assert other_exporter.get(f"/api/files/{uploaded}").status_code == 404

    def test_invited_exporter_can_download(self, backend, exporter, uploaded, owned_rfq):
        backend.store.insert("exporter_invitations", {
            "invitation_id": f"inv_{uuid.uuid4().hex[:8]}", "rfq_id": owned_rfq,
            "exporter_company_id": exporter.company_id, "status": "invited",
        })
        assert exporter.get(f"/api/files/{uploaded}").status_code == 200

    def test_anonymous_cannot_download(self, backend, uploaded):
        assert backend.anonymous().get(f"/api/files/{uploaded}").status_code == 401

    def test_session_token_in_query_string_is_rejected(self, backend, buyer, uploaded):
        """Session tokens must not travel in URLs — they land in logs and referrers."""
        r = backend.anonymous().get(f"/api/files/{uploaded}?auth={buyer.token}")
        assert r.status_code == 401, f"query-string session auth still accepted ({r.status_code})"
