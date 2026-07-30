"""Iteration 2 backend tests: Quotation Builder + Milestone Tracker."""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://india-supply.preview.emergentagent.com"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

mc = MongoClient(MONGO_URL)
db = mc[DB_NAME]


def seed_session(role: str, company_id: str = None) -> tuple[str, str]:
    """Insert a user + session directly and return (session_token, user_id)."""
    uid = f"test-{role}-{uuid.uuid4().hex[:8]}"
    tok = f"tok_{uuid.uuid4().hex}"
    cid = company_id or f"co_test_{uuid.uuid4().hex[:8]}"
    db.users.insert_one({
        "user_id": uid,
        "email": f"{uid}@example.com",
        "name": f"Test {role}",
        "role": role,
        "onboarded": True,
        "company_id": cid,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": tok,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return tok, uid, cid


@pytest.fixture(scope="module")
def admin_client():
    tok, uid, cid = seed_session("admin")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    yield s, uid, cid
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def buyer_owner_client():
    tok, uid, cid = seed_session("buyer")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    yield s, uid, cid
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def buyer_other_client():
    tok, uid, cid = seed_session("buyer")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    yield s, uid, cid
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def seeded_rfq(admin_client, buyer_owner_client):
    """Create an RFQ owned by buyer_owner's company (via direct DB) so buyer sees it."""
    _, _, buyer_cid = buyer_owner_client
    rfq_id = f"rfq_test_{uuid.uuid4().hex[:8]}"
    doc = {
        "rfq_id": rfq_id,
        "rfq_number": f"NRV-TEST-{uuid.uuid4().hex[:5].upper()}",
        "buyer_user_id": None,
        "buyer_company_id": buyer_cid,
        "product_category": "Rings",
        "product_name": "TEST Silver Ring",
        "short_description": "test",
        "kind": "custom",
        "quantity": "100",
        "destination_country": "US",
        "status": "submitted",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.rfqs.insert_one(doc)
    yield rfq_id
    db.rfqs.delete_one({"rfq_id": rfq_id})
    db.exporter_quotations.delete_many({"rfq_id": rfq_id})
    db.buyer_quotations.delete_many({"rfq_id": rfq_id})
    db.orders.delete_many({"rfq_id": rfq_id})


# ---------- Admin quotations (comparison) ----------
class TestAdminQuotations:
    def test_admin_create_quotation(self, admin_client, seeded_rfq):
        s, _, _ = admin_client
        r = s.post(f"{BASE_URL}/api/admin/quotations", json={
            "rfq_id": seeded_rfq,
            "exporter_company_id": "manual_1",
            "exporter_name": "Jaipur Silver Works",
            "unit_price": 6.80,
            "currency": "USD",
            "quantity": "500",
            "moq": "300",
            "lead_time": "30 days",
            "payment_terms": "30/70",
            "incoterm": "FOB",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "quotation_id" in d
        assert d["exporter_name"] == "Jaipur Silver Works"
        assert d["unit_price"] == 6.80

    def test_admin_list_quotations(self, admin_client, seeded_rfq):
        s, _, _ = admin_client
        # add second one
        s.post(f"{BASE_URL}/api/admin/quotations", json={
            "rfq_id": seeded_rfq, "exporter_company_id": "manual_2",
            "exporter_name": "Rajwada Exports", "unit_price": 7.20,
            "quantity": "500", "currency": "USD",
        })
        r = s.get(f"{BASE_URL}/api/admin/quotations?rfq_id={seeded_rfq}")
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 2
        assert all(q["rfq_id"] == seeded_rfq for q in arr)


# ---------- Buyer quotations ----------
class TestBuyerQuotations:
    def test_create_draft(self, admin_client, seeded_rfq):
        s, _, _ = admin_client
        r = s.post(f"{BASE_URL}/api/admin/buyer-quotations", json={
            "rfq_id": seeded_rfq,
            "total_price": 3400.00,
            "currency": "USD",
            "quantity": "500",
            "lead_time": "30 days",
            "payment_schedule": [
                {"label": "30% deposit", "percent": 30, "trigger": "confirm", "status": "not_due"},
                {"label": "70% before shipment", "percent": 70, "trigger": "ready", "status": "not_due"},
            ],
            "internal_costs": {"exporter_cost": 6.80, "margin_pct": 25},
            "internal_notes": "SECRET_MARGIN_25",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "buyer_quotation_id" in d
        assert d["status"] == "draft"
        pytest.bq_id = d["buyer_quotation_id"]

    def test_publish_buyer_quotation(self, admin_client):
        s, _, _ = admin_client
        r = s.patch(f"{BASE_URL}/api/admin/buyer-quotations/{pytest.bq_id}", json={"status": "published"})
        assert r.status_code == 200
        assert r.json().get("status") == "published"

    def test_admin_lists_with_internal(self, admin_client, seeded_rfq):
        s, _, _ = admin_client
        r = s.get(f"{BASE_URL}/api/buyer-quotations?rfq_id={seeded_rfq}")
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) >= 1
        d = next(x for x in docs if x["buyer_quotation_id"] == pytest.bq_id)
        assert "internal_costs" in d, "Admin should see internal_costs"
        assert d.get("internal_notes") == "SECRET_MARGIN_25"

    def test_buyer_strips_internal_and_only_own(self, buyer_owner_client, buyer_other_client):
        s_owner, _, _ = buyer_owner_client
        r = s_owner.get(f"{BASE_URL}/api/buyer-quotations")
        assert r.status_code == 200, r.text
        docs = r.json()
        # Owner should see the published buyer_quotation
        assert any(d["buyer_quotation_id"] == pytest.bq_id for d in docs), "buyer owner must see published BQ"
        for d in docs:
            assert "internal_costs" not in d, f"internal_costs leaked to buyer: {d}"
            assert "internal_notes" not in d, "internal_notes leaked to buyer"

        # Other buyer must NOT see it
        s_other, _, _ = buyer_other_client
        r2 = s_other.get(f"{BASE_URL}/api/buyer-quotations")
        assert r2.status_code == 200
        assert not any(d["buyer_quotation_id"] == pytest.bq_id for d in r2.json()), "buyer_quotation leaked to unrelated buyer"


# ---------- Orders + milestones ----------
class TestOrdersAndMilestones:
    def test_create_order(self, admin_client, seeded_rfq):
        s, _, _ = admin_client
        r = s.post(f"{BASE_URL}/api/admin/orders", json={
            "rfq_id": seeded_rfq,
            "exporter_company_id": "manual_1",
            "total_price": 3400.00,
            "currency": "USD",
            "milestones": [
                {"label": "30% deposit", "percent": 30, "trigger": "confirm", "status": "not_due", "amount": 1020.0},
                {"label": "70% before shipment", "percent": 70, "trigger": "ready", "status": "not_due", "amount": 2380.0},
            ],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "order_id" in d
        assert len(d["milestones"]) == 2
        pytest.order_id = d["order_id"]

    def test_get_order_admin(self, admin_client):
        s, _, _ = admin_client
        r = s.get(f"{BASE_URL}/api/orders/{pytest.order_id}")
        assert r.status_code == 200, f"GET /api/orders/{{id}} missing? -> {r.status_code} {r.text[:200]}"
        assert r.json()["order_id"] == pytest.order_id

    def test_get_order_buyer_owner(self, buyer_owner_client):
        s, _, _ = buyer_owner_client
        r = s.get(f"{BASE_URL}/api/orders/{pytest.order_id}")
        assert r.status_code == 200, f"buyer owner should get 200: {r.status_code} {r.text[:200]}"

    def test_get_order_other_buyer_403(self, buyer_other_client):
        s, _, _ = buyer_other_client
        r = s.get(f"{BASE_URL}/api/orders/{pytest.order_id}")
        assert r.status_code == 403, f"unrelated buyer should get 403, got {r.status_code}"

    def test_patch_milestones(self, admin_client):
        s, _, _ = admin_client
        r = s.patch(f"{BASE_URL}/api/admin/orders/{pytest.order_id}/milestones", json={
            "milestones": [
                {"label": "30% deposit", "percent": 30, "trigger": "confirm", "status": "paid", "amount": 1020.0},
                {"label": "70% before shipment", "percent": 70, "trigger": "ready", "status": "due", "amount": 2380.0},
            ]
        })
        assert r.status_code == 200, f"PATCH milestones missing? -> {r.status_code} {r.text[:200]}"
        d = r.json()
        assert d["milestones"][0]["status"] == "paid"

    def test_patch_order_status(self, admin_client):
        s, _, _ = admin_client
        before = db.activity_logs.count_documents({})
        r = s.patch(f"{BASE_URL}/api/admin/orders/{pytest.order_id}", json={"status": "in_production"})
        assert r.status_code == 200, f"PATCH order missing? -> {r.status_code} {r.text[:200]}"
        # Reload
        rr = s.get(f"{BASE_URL}/api/orders/{pytest.order_id}")
        assert rr.status_code == 200
        assert rr.json().get("status") == "in_production"
        after = db.activity_logs.count_documents({})
        assert after > before, "activity_logs entry should be added on order patch"
