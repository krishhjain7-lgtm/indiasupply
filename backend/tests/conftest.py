"""Shared test harness.

Runs in two modes so the same test file works in CI and on a dev box:

* **live** — when ``NORVIAN_TEST_LIVE=1`` and ``REACT_APP_BACKEND_URL`` are set, tests hit the
  deployed preview backend and seed through the real Mongo, exactly like ``test_iteration2.py``.
* **local** — otherwise the app is imported and served in-process against an in-memory Mongo
  (``mongomock_motor``). No preview deployment, no mongod, no network.

Both modes expose the same two things: ``api`` (make an authenticated client for a role) and
``store`` (insert/read fixture documents). Tests never talk to a driver directly.
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
LIVE = os.environ.get("NORVIAN_TEST_LIVE") == "1" and bool(os.environ.get("REACT_APP_BACKEND_URL"))


def utcnow():
    return datetime.now(timezone.utc).isoformat()


class ApiClient:
    """Thin request wrapper: same surface in both modes, auth header baked in."""

    def __init__(self, call, token=None, user_id=None, company_id=None):
        self._call = call
        self.token = token
        self.user_id = user_id
        self.company_id = company_id

    def _request(self, method, path, **kw):
        headers = dict(kw.pop("headers", None) or {})
        if self.token:
            headers.setdefault("Authorization", f"Bearer {self.token}")
        return self._call(method, path, headers=headers, **kw)

    def get(self, path, **kw):
        return self._request("GET", path, **kw)

    def post(self, path, **kw):
        return self._request("POST", path, **kw)

    def patch(self, path, **kw):
        return self._request("PATCH", path, **kw)

    def delete(self, path, **kw):
        return self._request("DELETE", path, **kw)


class Store:
    """Fixture-document access, hiding the sync/async driver split between modes."""

    def __init__(self, insert, find_one, count, delete_many):
        self.insert = insert
        self.find_one = find_one
        self.count = count
        self.delete_many = delete_many


class Harness:
    def __init__(self, call, store):
        self._call = call
        self.store = store
        self._created = []

    def anonymous(self):
        return ApiClient(self._call)

    def api(self, role, company_id=None, with_company=True, **extra):
        """Seed a user + session for ``role`` and return a client authenticated as them.

        ``with_company=False`` models a signed-in user who has not onboarded yet — the state
        that used to match anonymous records on a null company_id.
        """
        uid = f"test-{role}-{uuid.uuid4().hex[:8]}"
        token = f"tok_{uuid.uuid4().hex}"
        cid = (company_id or f"co_test_{uuid.uuid4().hex[:8]}") if with_company else None
        self.store.insert("users", {
            "user_id": uid,
            "email": f"{uid}@example.com",
            "name": f"Test {role}",
            "role": role,
            "onboarded": with_company,
            "company_id": cid,
            "created_at": utcnow(),
            **extra,
        })
        self.store.insert("user_sessions", {
            "user_id": uid,
            "session_token": token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "created_at": utcnow(),
        })
        self._created.append((uid, token))
        return ApiClient(self._call, token=token, user_id=uid, company_id=cid)

    def cleanup(self):
        for uid, token in self._created:
            self.store.delete_many("users", {"user_id": uid})
            self.store.delete_many("user_sessions", {"session_token": token})
        self._created.clear()


def _live_harness():
    import requests
    from pymongo import MongoClient

    base = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
    db = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[
        os.environ.get("DB_NAME", "test_database")
    ]
    session = requests.Session()

    def call(method, path, **kw):
        return session.request(method, f"{base}{path}", timeout=60, **kw)

    store = Store(
        insert=lambda c, d: db[c].insert_one(d),
        find_one=lambda c, q: db[c].find_one(q, {"_id": 0}),
        count=lambda c, q: db[c].count_documents(q),
        delete_many=lambda c, q: db[c].delete_many(q),
    )
    return Harness(call, store), None


def _local_harness():
    mongomock_motor = pytest.importorskip(
        "mongomock_motor",
        reason="local test mode needs mongomock-motor (pip install mongomock-motor)",
    )
    import sys

    os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
    os.environ.setdefault("DB_NAME", "norvian_test")
    # The app refuses to boot on a wildcard CORS origin (see P0.5), so give it a real one.
    os.environ.setdefault("CORS_ORIGINS", "http://testserver")
    os.environ.setdefault("OWNER_EMAIL", "owner@norvian.test")
    sys.path.insert(0, str(BACKEND_DIR))

    import server
    from fastapi.testclient import TestClient

    server.db = mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"]]

    # Managed object storage is an external service; stand in for it so file *authorisation*
    # stays under test without a network round trip.
    objects = {}

    def put_object(path, data, content_type):
        objects[path] = (data, content_type)
        return {"path": path, "size": len(data)}

    def get_object(path):
        if path not in objects:
            raise server.HTTPException(status_code=404, detail="Not found")
        return objects[path]

    server.put_object = put_object
    server.get_object = get_object

    client = TestClient(server.app)
    client.__enter__()  # run startup/lifespan once: seeds catalogue + demo order

    def call(method, path, **kw):
        return client.request(method, path, **kw)

    def run(coro):
        return asyncio.run(coro)

    store = Store(
        insert=lambda c, d: run(server.db[c].insert_one(dict(d))),
        find_one=lambda c, q: run(server.db[c].find_one(q, {"_id": 0})),
        count=lambda c, q: run(server.db[c].count_documents(q)),
        delete_many=lambda c, q: run(server.db[c].delete_many(q)),
    )
    return Harness(call, store), lambda: client.__exit__(None, None, None)


@pytest.fixture(scope="module")
def backend():
    harness, teardown = _live_harness() if LIVE else _local_harness()
    yield harness
    harness.cleanup()
    if teardown:
        teardown()


@pytest.fixture(scope="module")
def admin(backend):
    return backend.api("admin")


@pytest.fixture(scope="module")
def buyer(backend):
    return backend.api("buyer")


@pytest.fixture(scope="module")
def other_buyer(backend):
    return backend.api("buyer")


@pytest.fixture(scope="module")
def exporter(backend):
    return backend.api("exporter")


@pytest.fixture(scope="module")
def other_exporter(backend):
    return backend.api("exporter")


def make_rfq(backend, buyer_company_id, **overrides):
    """Insert an RFQ owned by ``buyer_company_id`` and return its id."""
    rfq_id = f"rfq_test_{uuid.uuid4().hex[:8]}"
    doc = {
        "rfq_id": rfq_id,
        "rfq_number": f"NRV-TEST-{uuid.uuid4().hex[:5].upper()}",
        "buyer_user_id": None,
        "buyer_company_id": buyer_company_id,
        "product_category": "Jewellery",
        "product_name": "TEST Silver Ring",
        "short_description": "test",
        "kind": "custom",
        "quantity": "100",
        "destination_country": "US",
        "status": "submitted",
        "category_fields": {"base_metal": "925 Silver", "stone_type": "Green Onyx"},
        "created_at": utcnow(),
        **overrides,
    }
    backend.store.insert("rfqs", doc)
    return rfq_id
