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


class TestVerifiedProductionRun:
    """The full walkthrough: locked specification, three checkpoints, a failure that holds the
    line, a corrective action, and the performance record the run leaves behind."""

    @pytest.fixture(scope="class")
    def ctx(self, backend):
        admin = backend.api("admin")
        buyer = backend.api("buyer")
        exporter = backend.api("exporter")
        backend.store.insert("companies", {
            "company_id": exporter.company_id, "kind": "exporter", "name": "Jaipur Silver Works",
            "city": "Jaipur", "main_category": "Jewellery", "work_email": "quotes@jsw.example"})
        rfq_id = make_rfq(backend, buyer.company_id, category_fields={
            "base_metal": "925 Silver", "stone_type": "Green Onyx",
            "dimensions": "18mm bezel", "plating": "Rhodium", "packaging": "Branded box",
        })
        return {"admin": admin, "buyer": buyer, "exporter": exporter, "rfq_id": rfq_id}

    def test_specification_seeds_from_the_rfq_vocabulary(self, ctx):
        r = ctx["admin"].post("/api/admin/specifications", json={"rfq_id": ctx["rfq_id"]})
        assert r.status_code == 200, r.text
        spec = r.json()
        assert spec["version"] == "1.0"
        assert spec["status"] == "proposed"
        names = {row["name"] for row in spec["rows"]}
        assert {"base_metal", "stone_type", "dimensions", "plating"} <= names, names
        assert next(r for r in spec["rows"] if r["name"] == "base_metal")["target"] == "925 Silver"

    def test_only_one_proposal_at_a_time(self, ctx):
        assert ctx["admin"].post("/api/admin/specifications",
                                 json={"rfq_id": ctx["rfq_id"]}).status_code == 409

    def test_no_inspection_without_a_locked_specification(self, backend, ctx):
        order = ctx["admin"].post("/api/admin/orders", json={
            "rfq_id": ctx["rfq_id"], "exporter_company_id": ctx["exporter"].company_id,
            "total_price": 3400.0, "currency": "USD",
            "milestones": [{"label": "30% deposit", "percent": 30, "trigger": "confirm",
                            "status": "paid", "amount": 1020.0, "due_date": "2099-01-01"}],
        }).json()
        pytest.order_id = order["order_id"]
        r = ctx["admin"].post("/api/admin/inspections", json={
            "order_id": pytest.order_id, "type": "first_article", "inspector": "QC",
            "measurements": [{"name": "base_metal", "target": "925 Silver", "result": "925", "status": "pass"}],
        })
        assert r.status_code == 409, r.text

    def test_buyer_acceptance_locks_the_specification(self, ctx):
        admin, buyer = ctx["admin"], ctx["buyer"]
        # Admin marks the critical rows before the buyer signs off.
        spec = admin.get(f"/api/specifications?rfq_id={ctx['rfq_id']}").json()[0]
        rows = [{**r, "critical": r["name"] in ("base_metal", "dimensions"), "tolerance": "±0.5mm"}
                for r in spec["rows"]]
        edited = admin.patch(f"/api/admin/specifications/{spec['specification_id']}", json={"rows": rows})
        assert edited.status_code == 200, edited.text

        bq = admin.post("/api/admin/buyer-quotations", json={
            "rfq_id": ctx["rfq_id"], "total_price": 3400.0, "currency": "USD", "quantity": "500",
            "lead_time": "30 days", "payment_schedule": [], "internal_notes": "margin 25",
        }).json()
        admin.patch(f"/api/admin/buyer-quotations/{bq['buyer_quotation_id']}", json={"status": "published"})

        accepted = buyer.post(f"/api/buyer-quotations/{bq['buyer_quotation_id']}/accept")
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["status"] == "accepted"
        assert "internal_notes" not in accepted.json(), "acceptance response leaked internal fields"

        locked = [s for s in admin.get(f"/api/specifications?rfq_id={ctx['rfq_id']}").json()
                  if s["status"] == "locked"]
        assert len(locked) == 1
        assert locked[0]["version"] == "1.0"
        assert locked[0]["locked_by"] == ctx["buyer"].company_id
        assert next(r for r in locked[0]["rows"] if r["name"] == "dimensions")["critical"] is True

    def test_locked_specification_cannot_be_edited(self, ctx):
        locked = next(s for s in ctx["admin"].get(f"/api/specifications?rfq_id={ctx['rfq_id']}").json()
                      if s["status"] == "locked")
        r = ctx["admin"].patch(f"/api/admin/specifications/{locked['specification_id']}",
                               json={"rows": [{"name": "dimensions", "target": "anything"}]})
        assert r.status_code == 409, r.text

    def test_first_article_passes(self, ctx):
        r = ctx["admin"].post("/api/admin/inspections", json={
            "order_id": pytest.order_id, "type": "first_article", "inspector": "A. Mehta",
            "measurements": [
                {"name": "base_metal", "target": "925 Silver", "result": "925 confirmed", "status": "pass"},
                {"name": "dimensions", "target": "18mm bezel", "result": "18.1mm", "status": "pass"},
                {"name": "plating", "target": "Rhodium", "result": "Rhodium", "status": "pass"},
            ],
        })
        assert r.status_code == 200, r.text
        assert r.json()["outcome"] == "pass"
        assert r.json()["spec_version"] == "1.0"
        assert ctx["admin"].get(f"/api/orders/{pytest.order_id}").json()["status"] != "production_hold"

    def test_mid_run_critical_failure_holds_the_line(self, ctx):
        r = ctx["admin"].post("/api/admin/inspections", json={
            "order_id": pytest.order_id, "type": "mid_run", "inspector": "A. Mehta",
            "measurements": [
                {"name": "base_metal", "target": "925 Silver", "result": "925", "status": "pass"},
                {"name": "dimensions", "target": "18mm bezel", "result": "19.4mm", "status": "fail"},
            ],
            "notes": "Bezel oversize on second casting batch",
        })
        assert r.status_code == 200, r.text
        assert r.json()["outcome"] == "fail"
        assert r.json()["critical_failures"] == 1
        pytest.failed_inspection = r.json()["inspection_id"]

        order = ctx["admin"].get(f"/api/orders/{pytest.order_id}").json()
        assert order["status"] == "production_hold"
        assert order["hold"]["inspection_id"] == pytest.failed_inspection

    def test_hold_blocks_manual_advancement(self, ctx):
        for target in ("cleared_to_ship", "shipped"):
            r = ctx["admin"].patch(f"/api/admin/orders/{pytest.order_id}", json={"status": target})
            assert r.status_code == 422, f"order on hold advanced to {target}"

    def test_reinspection_requires_a_corrective_action(self, ctx):
        r = ctx["admin"].post("/api/admin/inspections", json={
            "order_id": pytest.order_id, "type": "mid_run", "inspector": "A. Mehta",
            "measurements": [{"name": "dimensions", "target": "18mm bezel", "result": "18.0mm", "status": "pass"}],
        })
        assert r.status_code == 409, r.text

    def test_corrective_action_then_passing_reinspection_clears_the_hold(self, ctx):
        ca = ctx["admin"].post(f"/api/admin/inspections/{pytest.failed_inspection}/corrective-action",
                               json={"text": "Recut bezel die; re-polished affected batch",
                                     "owner": "Jaipur Silver Works"})
        assert ca.status_code == 200, ca.text
        assert ca.json()["corrective_action"]["owner"] == "Jaipur Silver Works"

        r = ctx["admin"].post("/api/admin/inspections", json={
            "order_id": pytest.order_id, "type": "mid_run", "inspector": "A. Mehta",
            "measurements": [
                {"name": "dimensions", "target": "18mm bezel", "result": "18.0mm", "status": "pass"},
                {"name": "base_metal", "target": "925 Silver", "result": "925", "status": "pass"},
            ],
        })
        assert r.status_code == 200, r.text
        assert r.json()["round"] == 2
        assert r.json()["cleared_hold"] is True
        assert ctx["admin"].get(f"/api/orders/{pytest.order_id}").json()["status"] == "in_production"

    def test_pre_shipment_pass_clears_to_ship(self, ctx):
        r = ctx["admin"].post("/api/admin/inspections", json={
            "order_id": pytest.order_id, "type": "pre_shipment", "inspector": "SGS",
            "measurements": [
                {"name": "base_metal", "target": "925 Silver", "result": "925", "status": "pass"},
                {"name": "dimensions", "target": "18mm bezel", "result": "18.0mm", "status": "pass"},
                {"name": "packaging", "target": "Branded box", "result": "Branded box", "status": "pass"},
            ],
        })
        assert r.status_code == 200, r.text
        assert ctx["admin"].get(f"/api/orders/{pytest.order_id}").json()["status"] == "cleared_to_ship"

    def test_buyer_sees_inspections_and_exporter_sees_own(self, backend, ctx):
        rows = ctx["buyer"].get(f"/api/inspections?order_id={pytest.order_id}")
        assert rows.status_code == 200
        assert len(rows.json()) == 4
        assert ctx["exporter"].get(f"/api/inspections?order_id={pytest.order_id}").status_code == 200
        stranger = backend.api("buyer")
        assert stranger.get(f"/api/inspections?order_id={pytest.order_id}").status_code == 404

    def test_completion_writes_a_run_and_moves_the_profile(self, backend, ctx):
        admin, exporter = ctx["admin"], ctx["exporter"]
        before = admin.get("/api/admin/exporter-performance").json()
        assert not any(p["exporter_company_id"] == exporter.company_id for p in before)

        assert admin.patch(f"/api/admin/orders/{pytest.order_id}", json={"status": "shipped"}).status_code == 200
        assert admin.patch(f"/api/admin/orders/{pytest.order_id}", json={"status": "delivered"}).status_code == 200

        profile = admin.get(f"/api/admin/exporter-performance/{exporter.company_id}").json()
        assert profile["runs"] == 1
        # First-pass conformance: 7 of the 8 round-one measurements passed.
        assert profile["conformance_pct"] == pytest.approx(87.5, abs=0.2)
        assert profile["corrective_actions"] == 1
        assert profile["on_time_pct"] == 100.0
        by_name = {a["name"]: a for a in profile["attributes"]}
        assert by_name["dimensions"]["conformance_pct"] == pytest.approx(66.7, abs=0.2)
        assert by_name["base_metal"]["conformance_pct"] == 100.0

        listed = admin.get("/api/admin/exporter-performance").json()
        assert any(p["exporter_company_id"] == exporter.company_id for p in listed)

    def test_run_record_is_written_once(self, backend, ctx):
        ctx["admin"].patch(f"/api/admin/orders/{pytest.order_id}", json={"status": "closed"})
        assert backend.store.count("production_runs", {"order_id": pytest.order_id}) == 1

    def test_respec_creates_a_new_version_needing_approval(self, ctx):
        admin, buyer = ctx["admin"], ctx["buyer"]
        r = admin.post("/api/admin/specifications", json={
            "rfq_id": ctx["rfq_id"],
            "rows": [{"name": "dimensions", "target": "20mm bezel", "tolerance": "±0.5mm", "critical": True}],
        })
        assert r.status_code == 200, r.text
        assert r.json()["version"] == "1.1"
        assert r.json()["status"] == "proposed"

        # The locked 1.0 stays locked until the buyer approves the replacement.
        specs = {s["version"]: s for s in admin.get(f"/api/specifications?rfq_id={ctx['rfq_id']}").json()}
        assert specs["1.0"]["status"] == "locked"

        assert buyer.post(f"/api/specifications/{r.json()['specification_id']}/approve").status_code == 200
        specs = {s["version"]: s for s in admin.get(f"/api/specifications?rfq_id={ctx['rfq_id']}").json()}
        assert specs["1.1"]["status"] == "locked"
        assert specs["1.0"]["status"] == "superseded"

    def test_exporter_sees_only_agreed_versions(self, backend, ctx):
        """A draft is an internal conversation between admin and buyer."""
        admin, exporter = ctx["admin"], ctx["exporter"]
        backend.store.insert("exporter_invitations", {
            "invitation_id": f"inv_{uuid.uuid4().hex[:8]}", "rfq_id": ctx["rfq_id"],
            "exporter_company_id": exporter.company_id, "status": "invited"})
        admin.post("/api/admin/specifications", json={
            "rfq_id": ctx["rfq_id"],
            "rows": [{"name": "finish", "target": "Matte, unapproved", "critical": False}]})

        seen = exporter.get(f"/api/specifications?rfq_id={ctx['rfq_id']}").json()
        assert seen, "invited exporter should see the agreed specification"
        assert all(s["status"] != "proposed" for s in seen), "exporter saw an unapproved draft"
        assert any(s["status"] == "locked" for s in seen)

    def test_exporter_cannot_approve_a_specification(self, ctx):
        admin, exporter = ctx["admin"], ctx["exporter"]
        proposal = next(s for s in admin.get(f"/api/specifications?rfq_id={ctx['rfq_id']}").json()
                        if s["status"] == "proposed")
        r = exporter.post(f"/api/specifications/{proposal['specification_id']}/approve")
        assert r.status_code == 404, f"exporter approved a specification ({r.status_code})"
