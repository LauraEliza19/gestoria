from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import update

from app.api.dependencies import CurrentUser, DatabaseSession
from app.config import settings
from app.models.auth_session import AuthSession
from app.schemas import CurrentUserRead, LoginRequest, OrganizationRead, SessionRead
from app.services import authenticate
from app.services.login_rate_limit import consume_login_attempt
from app.services.sessions import (
    create_session,
    now_utc,
    renew_session,
    revoke_cookie_session,
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


def limit_login_ip(request: Request, db: DatabaseSession):
    # Uvicorn trusts forwarded headers only from explicitly configured proxy IPs.
    ip = request.client.host if request.client else "unknown"
    consume_login_attempt(db, "ip", ip, settings.login_ip_limit)


@router.post(
    "/login", response_model=SessionRead, dependencies=[Depends(limit_login_ip)]
)
def login(
    payload: LoginRequest, request: Request, response: Response, db: DatabaseSession
):
    email = str(payload.email).strip().lower()
    consume_login_attempt(db, "account", email, settings.login_account_limit)
    authenticated = authenticate(db, email, payload.password)
    if not authenticated:
        raise HTTPException(401, "E-mail ou senha inválidos.")
    revoke_cookie_session(db, request)
    session = create_session(db, authenticated, payload.remember, response)
    return SessionRead(
        access_expires_at=session.access_expires_at, expires_at=session.expires_at
    )


@router.post("/refresh", response_model=SessionRead)
def refresh(request: Request, response: Response, db: DatabaseSession):
    session = renew_session(db, request, response)
    return SessionRead(
        access_expires_at=session.access_expires_at, expires_at=session.expires_at
    )


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: DatabaseSession):
    revoke_cookie_session(db, request)
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )


@router.post("/logout-all", status_code=204)
def logout_all(current: CurrentUser, db: DatabaseSession, response: Response):
    db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == current.user.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=now_utc())
    )
    db.commit()
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )


@router.get("/me", response_model=CurrentUserRead)
def get_me(current: CurrentUser):
    return CurrentUserRead(
        id=current.user.id,
        full_name=current.user.full_name,
        email=current.user.email,
        role=current.membership.role,
        organization=OrganizationRead.model_validate(current.organization),
    )
