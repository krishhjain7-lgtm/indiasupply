"""End-to-end workflow: invitation lifecycle, RFQ status machine, quotations, orders.

Also re-asserts the behaviour covered by test_iteration2.py so a regression is caught without a
deployed preview backend.
"""
import uuid

import pytest

from conftest import make_rfq


@pytest.fixture(scope="module")
def rfq(backend, buyer):
    return make_rfq(backend, buyer.company_id)


class TestRfqStatusMachine:
    def test_meta_exposes_the_vocabulary(self, admin):
        r = admin.get("/api/meta/rfq-statuses")
        assert r.status_code == 200
        meta = r.json()
        assert "submitted" in meta["statuses"]
        # Every declared transition target is itself a declared status.
        for src, targets in meta["transitions"].items():
            for t in targets:
                assert t in meta["statuses"], f"{src} -> {t} is not a known status"

    def test_unknown_status_is_rejected(self, admin, rfq):
        r = admin.patch(f"/api/rfqs/{rfq}/status", json={"status": "banana"})
        assert r.status_code == 422, r.text

    def test_illegal_jump_is_rejected(self, admin, rfq):
        """submitted -> shipped is not a state machine."""
        r = admin.patch(f"/api/rfqs/{rfq}/status", json={"status": "shipped"})
        assert r.status_code == 422, r.text
        assert admin.get(f"/api/rfqs/{rfq}").json()["status"] == "submitted"

    def test_legal_transition_is_applied_and_logged(self, backend, admin, rfq):
        before = backend.store.count("activity_logs", {"kind": "rfq_status"})
        r = admin.patch(f"/api/rfqs/{rfq}/status", json={"status": "under_review"})
        assert r.status_code == 200, r.text
        assert admin.get(f"/api/rfqs/{rfq}").json()["status"] == "under_review"
        assert backend.store.count("activity_logs", {"kind": "rfq_status"}) > before

    def test_buyer_cannot_change_status(self, buyer, rfq):
        assert buyer.patch(f"/api/rfqs/{rfq}/status", json={"status": "rejected"}).status_code == 403


class TestInvitationLifecycle:
    def test_invite_requires_a_target(self, admin, rfq):
        assert admin.post("/api/admin/invitations", json={"rfq_id": rfq}).status_code == 422

    def test_invite_company_then_dedupe(self, backend, admin, rfq, exporter):
        backend.store.insert("companies", {
            "company_id": exporter.company_id, "kind": "exporter", "name": "Jaipur Silver Works",
            "city": "Jaipur", "main_category": "Jewellery", "work_email": "quotes@jsw.example",
        })
        r = admin.post("/api/admin/invitations", json={
            "rfq_id": rfq, "exporter_company_id": exporter.company_id})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "invited"
        first = r.json()["invitation_id"]

        again = admin.post("/api/admin/invitations", json={
            "rfq_id": rfq, "exporter_company_id": exporter.company_id})
        assert again.json()["invitation_id"] == first, "re-inviting must not create a duplicate"

    def test_exporter_sees_it_and_view_is_recorded(self, admin, exporter, rfq):
        invs = exporter.get("/api/invitations").json()
        assert len(invs) == 1
        assert invs[0]["rfq"]["rfq_number"].startswith("NRV-")
        assert "contact_email" not in invs[0]["rfq"]
        assert "buyer_company_id" not in invs[0]["rfq"]

        assert exporter.get(f"/api/rfqs/{rfq}").status_code == 200
        state = admin.get(f"/api/admin/invitations?rfq_id={rfq}").json()[0]
        assert state["status"] == "viewed"

    def test_quoting_advances_the_invitation(self, admin, exporter, rfq):
        r = exporter.post("/api/quotations", json={
            "rfq_id": rfq, "unit_price": 6.8, "currency": "USD", "quantity": "500",
            "lead_time": "30 days", "payment_terms": "30/70", "incoterm": "FOB",
        })
        assert r.status_code == 200, r.text
        state = admin.get(f"/api/admin/invitations?rfq_id={rfq}").json()[0]
        assert state["status"] == "quoted"

    def test_invite_of_unknown_company_is_404(self, admin, rfq):
        assert admin.post("/api/admin/invitations", json={
            "rfq_id": rfq, "exporter_company_id": "co_does_not_exist"}).status_code == 404

    def test_decline(self, backend, admin, rfq):
        other = backend.api("exporter")
        backend.store.insert("companies", {
            "company_id": other.company_id, "kind": "exporter", "name": "Declining Exports",
            "work_email": "no@declining.example",
        })
        r = admin.post("/api/admin/invitations", json={"rfq_id": rfq, "exporter_company_id": other.company_id})
        assert r.status_code == 200, r.text
        inv = next(i for i in other.get("/api/invitations").json())
        assert other.post(f"/api/invitations/{inv['invitation_id']}/decline").status_code == 200
        assert other.get("/api/invitations").json()[0]["status"] == "declined"

    def test_decline_of_someone_elses_invitation_is_404(self, backend, admin, rfq, exporter):
        inv = exporter.get("/api/invitations").json()[0]
        stranger = backend.api("exporter")
        assert stranger.post(f"/api/invitations/{inv['invitation_id']}/decline").status_code == 404

    def test_email_invitation_is_claimed_at_onboarding(self, backend, admin, rfq):
        """An exporter invited before they had an account inherits the invitation on sign-up."""
        email = f"new-{uuid.uuid4().hex[:6]}@exporter.example"
        r = admin.post("/api/admin/invitations", json={
            "rfq_id": rfq, "email": email, "company_name": "Rajwada Exports"})
        assert r.status_code == 200, r.text
        assert r.json()["exporter_company_id"] is None

        newcomer = backend.api("buyer", with_company=False)
        onboard = newcomer.post("/api/onboarding/exporter", json={
            "contact_name": "R Sharma", "company_name": "Rajwada Exports", "work_email": email,
            "whatsapp": "+91", "city": "Jaipur", "state": "Rajasthan",
            "main_category": "Jewellery", "company_type": "Manufacturer",
            "short_description": "Silver jewellery manufacturer",
        })
        assert onboard.status_code == 200, onboard.text
        assert newcomer.get("/api/auth/me").json()["role"] == "exporter"

        invs = newcomer.get("/api/invitations").json()
        assert [i["rfq_id"] for i in invs] == [rfq], "email invitation was not claimed on onboarding"

    def test_uninvited_user_without_company_sees_nothing(self, backend, rfq):
        """A signed-in user with no company must not match anonymous (null-company) records."""
        stray = backend.api("buyer", with_company=False)
        assert stray.get("/api/rfqs").json() == []
        assert stray.get("/api/orders").json() == []
        assert stray.get("/api/buyer-quotations").json() == []


class TestQuotationsAndOrders:
    """Mirrors test_iteration2.py so the same guarantees are checked without a live backend."""

    def test_admin_creates_and_lists_exporter_quotations(self, admin, rfq):
        r = admin.post("/api/admin/quotations", json={
            "rfq_id": rfq, "exporter_company_id": "manual_1", "exporter_name": "Jaipur Silver Works",
            "unit_price": 6.80, "currency": "USD", "quantity": "500", "moq": "300",
            "lead_time": "30 days", "payment_terms": "30/70", "incoterm": "FOB",
        })
        assert r.status_code == 200, r.text
        assert r.json()["exporter_name"] == "Jaipur Silver Works"
        assert r.json()["unit_price"] == 6.80

        admin.post("/api/admin/quotations", json={
            "rfq_id": rfq, "exporter_company_id": "manual_2", "exporter_name": "Rajwada Exports",
            "unit_price": 7.20, "quantity": "500", "currency": "USD",
        })
        arr = admin.get(f"/api/admin/quotations?rfq_id={rfq}").json()
        assert len(arr) >= 2
        assert all(q["rfq_id"] == rfq for q in arr)

    def test_buyer_quotation_draft_publish_and_visibility(self, admin, buyer, rfq):
        r = admin.post("/api/admin/buyer-quotations", json={
            "rfq_id": rfq, "total_price": 3400.00, "currency": "USD", "quantity": "500",
            "lead_time": "30 days",
            "payment_schedule": [
                {"label": "30% deposit", "percent": 30, "trigger": "confirm", "status": "not_due"},
                {"label": "70% before shipment", "percent": 70, "trigger": "ready", "status": "not_due"},
            ],
            "internal_costs": {"exporter_cost": 6.80, "margin_pct": 25},
            "internal_notes": "SECRET_MARGIN_25",
        })
        assert r.status_code == 200, r.text
        bqid = r.json()["buyer_quotation_id"]
        assert r.json()["status"] == "draft"

        assert admin.patch(f"/api/admin/buyer-quotations/{bqid}",
                           json={"status": "published"}).json()["status"] == "published"

        seen_by_admin = next(d for d in admin.get(f"/api/buyer-quotations?rfq_id={rfq}").json()
                             if d["buyer_quotation_id"] == bqid)
        assert seen_by_admin["internal_notes"] == "SECRET_MARGIN_25"

        seen_by_buyer = buyer.get("/api/buyer-quotations").json()
        assert any(d["buyer_quotation_id"] == bqid for d in seen_by_buyer)
        for d in seen_by_buyer:
            assert "internal_costs" not in d and "internal_notes" not in d

    def test_order_creation_access_and_milestones(self, backend, admin, buyer, other_buyer, rfq):
        r = admin.post("/api/admin/orders", json={
            "rfq_id": rfq, "exporter_company_id": "manual_1", "total_price": 3400.00,
            "currency": "USD",
            "milestones": [
                {"label": "30% deposit", "percent": 30, "trigger": "confirm", "status": "not_due", "amount": 1020.0},
                {"label": "70% before shipment", "percent": 70, "trigger": "ready", "status": "not_due", "amount": 2380.0},
            ],
        })
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]
        assert len(r.json()["milestones"]) == 2

        assert admin.get(f"/api/orders/{oid}").json()["order_id"] == oid
        assert buyer.get(f"/api/orders/{oid}").status_code == 200
        assert other_buyer.get(f"/api/orders/{oid}").status_code == 403

        m = admin.patch(f"/api/admin/orders/{oid}/milestones", json={"milestones": [
            {"label": "30% deposit", "percent": 30, "trigger": "confirm", "status": "paid", "amount": 1020.0},
            {"label": "70% before shipment", "percent": 70, "trigger": "ready", "status": "due", "amount": 2380.0},
        ]})
        assert m.status_code == 200, m.text
        assert m.json()["milestones"][0]["status"] == "paid"

        before = backend.store.count("activity_logs", {})
        assert admin.patch(f"/api/admin/orders/{oid}", json={"status": "in_production"}).status_code == 200
        assert admin.get(f"/api/orders/{oid}").json()["status"] == "in_production"
        assert backend.store.count("activity_logs", {}) > before
