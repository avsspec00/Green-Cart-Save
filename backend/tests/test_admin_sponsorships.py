"""Backend tests for Green Cart Save admin + sponsorships system.

Covers:
- Admin login (form-encoded) & /admin/me auth
- Advertisers CRUD (auth-protected)
- Sponsorships CRUD (auth-protected) with advertiser_name resolution
- Public GET /api/sponsorships/active ordering by bid desc
- Cascade delete: deleting advertiser drops its sponsorships
"""

import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    return s


@pytest.fixture(scope="module")
def token(session):
    r = session.post(
        f"{API}/admin/login",
        data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert "access_token" in j and j.get("token_type") == "bearer"
    return j["access_token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---- Auth ------------------------------------------------------------------

class TestAuth:
    def test_login_wrong_password(self, session):
        r = session.post(
            f"{API}/admin/login",
            data={"username": ADMIN_EMAIL, "password": "wrong-password"},
        )
        assert r.status_code == 401

    def test_login_success(self, token):
        assert isinstance(token, str) and len(token) > 20

    def test_me_requires_token(self, session):
        r = session.get(f"{API}/admin/me")
        assert r.status_code == 401

    def test_me_returns_profile(self, session, auth_headers):
        r = session.get(f"{API}/admin/me", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == ADMIN_EMAIL
        assert "id" in body and "created_at" in body


# ---- Advertisers CRUD ------------------------------------------------------

class TestAdvertisers:
    created_id = None

    def test_list_requires_auth(self, session):
        r = session.get(f"{API}/admin/advertisers")
        assert r.status_code == 401

    def test_create_advertiser(self, session, auth_headers):
        payload = {
            "name": f"TEST_BrandCo_{uuid.uuid4().hex[:6]}",
            "contact_email": f"test+{uuid.uuid4().hex[:6]}@brand.com",
        }
        r = session.post(f"{API}/admin/advertisers", json=payload, headers=auth_headers)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == payload["name"]
        assert body["contact_email"] == payload["contact_email"]
        assert "id" in body and "created_at" in body
        TestAdvertisers.created_id = body["id"]

    def test_list_contains_created(self, session, auth_headers):
        r = session.get(f"{API}/admin/advertisers", headers=auth_headers)
        assert r.status_code == 200
        ids = [a["id"] for a in r.json()]
        assert TestAdvertisers.created_id in ids

    def test_delete_advertiser(self, session, auth_headers):
        r = session.delete(
            f"{API}/admin/advertisers/{TestAdvertisers.created_id}",
            headers=auth_headers,
        )
        assert r.status_code == 204
        # Confirm removal
        r2 = session.get(f"{API}/admin/advertisers", headers=auth_headers)
        ids = [a["id"] for a in r2.json()]
        assert TestAdvertisers.created_id not in ids


# ---- Sponsorships CRUD + Public list + Cascade ------------------------------

class TestSponsorshipsFlow:
    advertiser_id = None
    sponsorship_id = None
    second_sponsorship_id = None

    def test_setup_advertiser(self, session, auth_headers):
        payload = {
            "name": f"TEST_SponsorCo_{uuid.uuid4().hex[:6]}",
            "contact_email": f"sponsor+{uuid.uuid4().hex[:6]}@brand.com",
        }
        r = session.post(f"{API}/admin/advertisers", json=payload, headers=auth_headers)
        assert r.status_code == 201
        TestSponsorshipsFlow.advertiser_id = r.json()["id"]

    def test_create_sponsorship(self, session, auth_headers):
        body = {
            "advertiser_id": TestSponsorshipsFlow.advertiser_id,
            "product_id": "p17",
            "bid_cents": 5000,
            "active": True,
        }
        r = session.post(f"{API}/admin/sponsorships", json=body, headers=auth_headers)
        assert r.status_code == 201, r.text
        j = r.json()
        assert j["product_id"] == "p17"
        assert j["bid_cents"] == 5000
        assert j["active"] is True
        assert j["advertiser_id"] == TestSponsorshipsFlow.advertiser_id
        assert j.get("advertiser_name")  # resolved
        TestSponsorshipsFlow.sponsorship_id = j["id"]

    def test_create_sponsorship_invalid_advertiser(self, session, auth_headers):
        body = {
            "advertiser_id": "does-not-exist",
            "product_id": "p1",
            "bid_cents": 100,
        }
        r = session.post(f"{API}/admin/sponsorships", json=body, headers=auth_headers)
        assert r.status_code == 400

    def test_list_sponsorships_has_advertiser_name(self, session, auth_headers):
        r = session.get(f"{API}/admin/sponsorships", headers=auth_headers)
        assert r.status_code == 200
        rows = r.json()
        match = next((x for x in rows if x["id"] == TestSponsorshipsFlow.sponsorship_id), None)
        assert match is not None
        assert match["advertiser_name"]
        assert match["bid_cents"] == 5000

    def test_active_public_endpoint_ordering(self, session, auth_headers):
        # Add a second, higher-bid sponsorship on a different product
        body = {
            "advertiser_id": TestSponsorshipsFlow.advertiser_id,
            "product_id": "p2",
            "bid_cents": 9999,
            "active": True,
        }
        r = session.post(f"{API}/admin/sponsorships", json=body, headers=auth_headers)
        assert r.status_code == 201
        TestSponsorshipsFlow.second_sponsorship_id = r.json()["id"]

        r2 = session.get(f"{API}/sponsorships/active")
        assert r2.status_code == 200
        rows = r2.json()
        bids = [x["bid_cents"] for x in rows]
        assert bids == sorted(bids, reverse=True), f"Not sorted desc: {bids}"
        # our two sponsorships must be present and their advertiser_name resolved
        ours = [x for x in rows if x["product_id"] in ("p2", "p17")]
        assert len(ours) >= 2
        for o in ours:
            assert o["advertiser_name"]

    def test_patch_toggle_active(self, session, auth_headers):
        sid = TestSponsorshipsFlow.sponsorship_id
        r = session.patch(
            f"{API}/admin/sponsorships/{sid}",
            json={"active": False},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["active"] is False

        # Confirm via public endpoint — should no longer include p17
        r2 = session.get(f"{API}/sponsorships/active")
        assert r2.status_code == 200
        assert not any(
            x["product_id"] == "p17"
            and x["advertiser_name"] == r.json()["advertiser_name"]
            for x in r2.json()
        )

    def test_delete_sponsorship(self, session, auth_headers):
        sid = TestSponsorshipsFlow.sponsorship_id
        r = session.delete(f"{API}/admin/sponsorships/{sid}", headers=auth_headers)
        assert r.status_code == 204
        r2 = session.delete(f"{API}/admin/sponsorships/{sid}", headers=auth_headers)
        assert r2.status_code == 404

    def test_cascade_delete_advertiser(self, session, auth_headers):
        adv_id = TestSponsorshipsFlow.advertiser_id
        # advertiser still has the p2 sponsorship at this point
        r = session.delete(f"{API}/admin/advertisers/{adv_id}", headers=auth_headers)
        assert r.status_code == 204

        # All sponsorships for this advertiser must be gone
        r2 = session.get(f"{API}/admin/sponsorships", headers=auth_headers)
        remaining = [s for s in r2.json() if s["advertiser_id"] == adv_id]
        assert remaining == [], f"Cascade failed, leftovers: {remaining}"
