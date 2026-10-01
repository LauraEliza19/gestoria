import secrets
from datetime import timedelta

import pytest
from app.api.dependencies import get_current_user
from app.config import Settings, settings
from app.models import OrganizationMember, User
from app.models.auth_session import AuthSession
from app.production_setup import disable_demo_users
from app.security import hash_session_token
from app.seed import seed_demo_data
from app.services import authenticate
from app.services.sessions import create_session, now_utc
from fastapi import HTTPException, Response
from pydantic import ValidationError
from scripts.seed_pitch_demo import seed_pitch_demo
from sqlalchemy import select
from starlette.requests import Request

LOGIN = {"email": "lucas@gestoria.dev", "password": "SenhaForte@123"}


def sign_in(client, remember=False):
    response = client.post("/api/auth/login", json={**LOGIN, "remember": remember})
    assert response.status_code == 200, response.text
    return response


def test_cookie_only_and_hashed_storage(client, db):
    response = sign_in(client)
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert "Max-Age" not in cookie
    assert "access_token" not in response.json()
    token = client.cookies.get(settings.session_cookie_name)
    session = db.scalar(select(AuthSession))
    assert session.token_hash == hash_session_token(token)
    assert session.token_hash != token
    assert client.get("/api/auth/me").status_code == 200
    client.cookies.clear()
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
        ).status_code
        == 401
    )


def test_secure_cookie_remember_and_absolute_expiry(client, monkeypatch):
    monkeypatch.setattr(settings, "cookie_secure", True)
    response = sign_in(client, remember=True)
    cookie = response.headers["set-cookie"]
    assert cookie.startswith("__Host-gestoria_session=")
    assert "Secure" in cookie and "HttpOnly" in cookie and "Domain=" not in cookie
    assert "Max-Age=" in cookie


def test_refresh_rotates_and_does_not_extend_absolute_expiry(client, db):
    first = sign_in(client, remember=True)
    old = client.cookies.get(settings.session_cookie_name)
    session = db.scalar(select(AuthSession))
    session.access_expires_at = now_utc() - timedelta(seconds=1)
    db.commit()
    assert client.get("/api/auth/me").status_code == 401
    refreshed = client.post("/api/auth/refresh")
    assert refreshed.status_code == 200
    # SQLite strips tzinfo, compare normalized strings for this adapter.
    assert refreshed.json()["expires_at"].rstrip("Z") == first.json()[
        "expires_at"
    ].rstrip("Z")
    assert client.cookies.get(settings.session_cookie_name) != old
    assert client.get("/api/auth/me").status_code == 200
    headers = {"Cookie": f"{settings.session_cookie_name}={old}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert client.post("/api/auth/refresh", headers=headers).status_code == 401


def test_logout_revokes_replay_and_is_idempotent(client):
    sign_in(client)
    old = client.cookies.get(settings.session_cookie_name)
    response = client.post("/api/auth/logout")
    assert response.status_code == 204 and "Max-Age=0" in response.headers["set-cookie"]
    headers = {"Cookie": f"{settings.session_cookie_name}={old}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert client.post("/api/auth/refresh", headers=headers).status_code == 401
    assert client.post("/api/auth/logout").status_code == 204


def test_logout_all_revokes_other_sessions(client):
    sign_in(client)
    first = client.cookies.get(settings.session_cookie_name)
    client.cookies.clear()
    sign_in(client)
    assert client.post("/api/auth/logout-all").status_code == 204
    assert (
        client.post(
            "/api/auth/refresh",
            headers={"Cookie": f"{settings.session_cookie_name}={first}"},
        ).status_code
        == 401
    )


def test_login_replaces_existing_session(client):
    sign_in(client)
    old = client.cookies.get(settings.session_cookie_name)
    sign_in(client)
    assert (
        client.get(
            "/api/auth/me", headers={"Cookie": f"{settings.session_cookie_name}={old}"}
        ).status_code
        == 401
    )


@pytest.mark.parametrize(
    "change", ["absolute_expiry", "inactive_user", "inactive_membership", "revoked"]
)
def test_session_rechecks_expiry_user_and_membership(client, db, change):
    sign_in(client)
    session = db.scalar(select(AuthSession))
    if change == "absolute_expiry":
        session.expires_at = now_utc() - timedelta(seconds=1)
    elif change == "revoked":
        session.revoked_at = now_utc()
    elif change == "inactive_user":
        db.get(User, session.user_id).is_active = False
    else:
        db.get(
            OrganizationMember, (session.organization_id, session.user_id)
        ).is_active = False
    db.commit()
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/refresh").status_code == 401


def test_dependency_rejects_missing_invalid_and_unknown_cookie(db):
    for cookie in ["", "gestoria_session=invalid"]:
        with pytest.raises(HTTPException) as exc:
            get_current_user(
                db, Request({"type": "http", "headers": [(b"cookie", cookie.encode())]})
            )
        assert exc.value.status_code == 401


@pytest.mark.parametrize(
    "path",
    [
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/refresh",
        "/api/auth/logout-all",
        "/api/products",
    ],
)
def test_csrf_required_for_all_mutations(client, path):
    assert (
        client.post(path, headers={"X-CSRF-Protection": ""}, json=LOGIN).status_code
        == 403
    )
    assert (
        client.post(
            path, headers={"Origin": "https://attacker.example"}, json=LOGIN
        ).status_code
        == 403
    )
    assert (
        client.post(
            path, headers={"Sec-Fetch-Site": "cross-site"}, json=LOGIN
        ).status_code
        == 403
    )


def test_origin_null_rejected_and_same_origin_allowed(client):
    assert (
        client.post(
            "/api/auth/login", headers={"Origin": "null"}, json=LOGIN
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/auth/login", headers={"Origin": "http://localhost:5173"}, json=LOGIN
        ).status_code
        == 200
    )
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Headers": "X-CSRF-Protection",
        },
    )
    assert "access-control-allow-origin" not in response.headers


def test_account_rate_limit_normalizes_email(client, monkeypatch):
    monkeypatch.setattr(settings, "login_account_limit", 2)
    bad = {**LOGIN, "password": "wrong-password"}
    assert client.post("/api/auth/login", json=bad).status_code == 401
    assert (
        client.post(
            "/api/auth/login", json={**bad, "email": "LUCAS@gestoria.dev"}
        ).status_code
        == 401
    )
    response = client.post("/api/auth/login", json=LOGIN)
    assert response.status_code == 429 and int(response.headers["Retry-After"]) > 0


def test_ip_rate_limit_covers_invalid_payloads_and_ignores_spoofed_forwarded_header(
    client, monkeypatch
):
    monkeypatch.setattr(settings, "login_ip_limit", 2)
    for i in range(2):
        assert (
            client.post(
                "/api/auth/login", json={}, headers={"X-Forwarded-For": f"192.0.2.{i}"}
            ).status_code
            == 422
        )
    assert (
        client.post(
            "/api/auth/login", json=LOGIN, headers={"X-Forwarded-For": "198.51.100.1"}
        ).status_code
        == 429
    )


def test_rate_window_recovers(client, monkeypatch):
    monkeypatch.setattr(settings, "login_account_limit", 1)
    monkeypatch.setattr("app.services.login_rate_limit.time.time", lambda: 1800)
    sign_in(client)
    assert client.post("/api/auth/login", json=LOGIN).status_code == 429
    monkeypatch.setattr("app.services.login_rate_limit.time.time", lambda: 2701)
    sign_in(client)


def test_security_headers_on_success_error_static_and_csrf(client, monkeypatch):
    for path in [
        "/",
        "/api/health",
        "/api/auth/me",
        "/api/missing",
        "/assets/missing.js",
    ]:
        response = client.get(path)
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
    assert client.get("/api/auth/me").headers["Cache-Control"] == "no-store"
    assert client.get("/", headers={"Host": "evil.example"}).status_code == 400
    monkeypatch.setattr(settings, "app_env", "production")
    assert client.get("/api/health").status_code == 400  # Plain HTTP blocked.
    response = client.get("https://testserver/api/health")
    assert (
        response.status_code == 200
        and "max-age=" in response.headers["Strict-Transport-Security"]
    )


def production_settings(**changes):
    values = {
        "app_env": "production",
        "cookie_secure": True,
        "allowed_hosts": ["erp.example.com"],
        "allowed_origins": ["https://erp.example.com"],
        "database_url": "postgresql+psycopg://app:"
        + secrets.token_urlsafe(32)
        + "@db/app",
        "operation_signing_keys": '{"v1":"' + secrets.token_hex(32) + '"}',
    }
    return Settings(_env_file=None, **(values | changes))


def test_valid_production_config():
    assert production_settings().session_cookie_name.startswith("__Host-")


@pytest.mark.parametrize(
    "changes",
    [
        {"cookie_secure": False},
        {"demo_enabled": True},
        {"demo_password": "anything"},
        {"allowed_hosts": ["*"]},
        {"allowed_origins": ["http://erp.example.com"]},
        {"allowed_origins": ["https://erp.example.com/path"]},
        {"operation_signing_keys": ""},
        {"database_url": "postgresql+psycopg://gestoria:gestoria_dev@db/gestoria"},
    ],
)
def test_unsafe_production_config_refused(changes):
    with pytest.raises(ValidationError):
        production_settings(**changes)


def test_demo_seed_refused_in_production_and_disabled_by_default(db, monkeypatch):
    for enabled, env in [(False, "development"), (True, "production")]:
        monkeypatch.setattr(settings, "demo_enabled", enabled)
        monkeypatch.setattr(settings, "app_env", env)
        for seed in [seed_demo_data, seed_pitch_demo]:
            with pytest.raises(RuntimeError):
                seed(db)


def test_production_disables_old_demo_and_revokes_sessions(db, monkeypatch):
    user = db.scalar(select(User).where(User.email == LOGIN["email"]))
    user.email = "admin@gestoria.dev"
    db.commit()
    current = authenticate(db, user.email, LOGIN["password"])
    create_session(db, current, False, Response())
    monkeypatch.setattr(settings, "app_env", "production")
    assert authenticate(db, user.email, LOGIN["password"]) is None
    disable_demo_users(db)
    db.refresh(user)
    assert not user.is_active
    assert db.scalar(select(AuthSession)).revoked_at is not None
    assert db.get(User, user.id) is not None  # Preserve fiscal/audit history.


def test_unhandled_error_response_keeps_security_headers():
    from app.http_security import SecurityMiddleware
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()

    @app.get("/api/error")
    def error():
        raise RuntimeError("Test-only failure")

    with TestClient(SecurityMiddleware(app), raise_server_exceptions=False) as client:
        response = client.get("/api/error")
    assert response.status_code == 500
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Cache-Control"] == "no-store"
