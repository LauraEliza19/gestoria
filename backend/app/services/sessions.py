import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.auth_session import AuthSession
from app.repositories import OrganizationRepository, UserRepository
from app.security import hash_session_token
from app.services.auth import AuthenticatedUser, is_demo_account


def now_utc():
    return datetime.now(timezone.utc)


def as_utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def unauthorized():
    return HTTPException(401, "Sessão inválida ou expirada.")


def find_session(db: Session, token: str | None, *, allow_expired_access=False):
    if not token or len(token) > 128:
        raise unauthorized()
    session = db.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_session_token(token))
    )
    now = now_utc()
    if not session or session.revoked_at or as_utc(session.expires_at) <= now:
        raise unauthorized()
    if not allow_expired_access and as_utc(session.access_expires_at) <= now:
        raise unauthorized()
    return session


def session_user(db: Session, session: AuthSession):
    user = UserRepository.get_by_id(db, session.user_id)
    membership = UserRepository.get_membership(
        db, session.user_id, session.organization_id
    )
    organization = OrganizationRepository.get_by_id(db, session.organization_id)
    if (
        not user
        or not user.is_active
        or not membership
        or not membership.is_active
        or not organization
    ):
        raise unauthorized()
    if settings.app_env == "production" and is_demo_account(user):
        raise unauthorized()
    return AuthenticatedUser(user, membership, organization)


def write_cookie(response: Response, token: str, session: AuthSession):
    remaining = max(0, int((as_utc(session.expires_at) - now_utc()).total_seconds()))
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=remaining if session.remember else None,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"


def create_session(
    db: Session, current: AuthenticatedUser, remember: bool, response: Response
):
    now = now_utc()
    token = secrets.token_urlsafe(32)
    expires = now + (
        timedelta(days=settings.session_remember_days)
        if remember
        else timedelta(hours=settings.session_hours)
    )
    session = AuthSession(
        user_id=current.user.id,
        organization_id=current.organization.id,
        token_hash=hash_session_token(token),
        created_at=now,
        access_expires_at=min(
            expires, now + timedelta(minutes=settings.session_access_minutes)
        ),
        expires_at=expires,
        remember=remember,
    )
    db.execute(
        delete(AuthSession)
        .where(AuthSession.expires_at < now)
        .execution_options(synchronize_session=False)
    )
    db.add(session)
    db.commit()
    write_cookie(response, token, session)
    return session


def revoke_cookie_session(db: Session, request: Request):
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        db.execute(
            update(AuthSession)
            .where(
                AuthSession.token_hash == hash_session_token(token),
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=now_utc())
        )
        db.commit()


def renew_session(db: Session, request: Request, response: Response):
    session = find_session(
        db, request.cookies.get(settings.session_cookie_name), allow_expired_access=True
    )
    session_user(db, session)
    now = now_utc()
    token = secrets.token_urlsafe(32)
    # Compare-and-swap prevents two workers from renewing the same credential.
    result = db.execute(
        update(AuthSession)
        .where(
            AuthSession.id == session.id,
            AuthSession.token_hash == session.token_hash,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
        .values(
            token_hash=hash_session_token(token),
            access_expires_at=min(
                as_utc(session.expires_at),
                now + timedelta(minutes=settings.session_access_minutes),
            ),
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise unauthorized()
    db.commit()
    db.refresh(session)
    write_cookie(response, token, session)
    return session
