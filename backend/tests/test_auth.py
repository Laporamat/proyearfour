"""Backend auth endpoint tests for QuantAI Emergent Google auth."""
import os
import requests
import pytest

BASE_URL = "https://clean-ui-15.preview.emergentagent.com"
API = f"{BASE_URL}/api"

# Pre-seeded persistent demo session token
DEMO_TOKEN = "demo_session_persistent"


class TestAuthMe:
    def test_me_no_cookie_returns_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_bearer_token_returns_user(self):
        r = requests.get(f"{API}/auth/me",
                         headers={"Authorization": f"Bearer {DEMO_TOKEN}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == "user_demo"
        assert data["email"] == "demo@quantai.local"
        assert data["name"] == "Demo User"
        assert "picture" in data

    def test_me_with_cookie_returns_user(self):
        r = requests.get(f"{API}/auth/me",
                         cookies={"session_token": DEMO_TOKEN})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == "demo@quantai.local"

    def test_me_invalid_token_returns_401(self):
        r = requests.get(f"{API}/auth/me",
                         headers={"Authorization": "Bearer bogus_token_xyz"})
        assert r.status_code == 401


class TestAuthSession:
    def test_session_missing_body_returns_400(self):
        r = requests.post(f"{API}/auth/session", json={})
        assert r.status_code == 400

    def test_session_invalid_session_id_returns_401(self):
        r = requests.post(f"{API}/auth/session",
                          json={"session_id": "invalid-session-id-xyz"})
        assert r.status_code == 401


class TestAuthLogout:
    def test_logout_and_verify_session_deleted(self):
        # Seed a throwaway session
        import pymongo
        from datetime import datetime, timezone, timedelta
        mc = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = mc[os.environ.get("DB_NAME", "quantai")]
        tok = "TEST_logout_token_xyz"
        db.users.update_one(
            {"user_id": "TEST_logout_user"},
            {"$set": {"user_id": "TEST_logout_user", "email": "TEST_logout@x.io",
                      "name": "Logout Test", "picture": ""}},
            upsert=True,
        )
        db.user_sessions.delete_many({"session_token": tok})
        db.user_sessions.insert_one({
            "user_id": "TEST_logout_user",
            "session_token": tok,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
            "created_at": datetime.now(timezone.utc),
        })

        # /me works
        r = requests.get(f"{API}/auth/me",
                         headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200

        # Logout with cookie
        r = requests.post(f"{API}/auth/logout",
                         cookies={"session_token": tok})
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # /me with same token now fails
        r = requests.get(f"{API}/auth/me",
                         headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 401

        # cleanup
        db.users.delete_one({"user_id": "TEST_logout_user"})
        db.user_sessions.delete_many({"session_token": tok})


class TestProtectedProxy:
    def test_health_reachable(self):
        r = requests.get(f"{BASE_URL}/api/prices?n=1", timeout=15)
        # 200 or 404 (if no CSV) — but not 5xx or connectivity fail
        assert r.status_code in (200, 404, 500), r.status_code
