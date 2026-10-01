"""Run after migrations. Disable old demonstration accounts without deleting history."""

import secrets

from sqlalchemy import select, update

from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.models.auth_session import AuthSession
from app.security import hash_password
from app.seed import seed_demo_data
from app.services.auth import is_demo_account
from app.services.sessions import now_utc


def disable_demo_users(db):
    for user in db.scalars(select(User)):
        if is_demo_account(user):
            user.is_active = False
            user.password_hash = hash_password(secrets.token_urlsafe(48))
            db.execute(
                update(AuthSession)
                .where(AuthSession.user_id == user.id)
                .values(revoked_at=now_utc())
            )
    db.commit()


def main():
    with SessionLocal() as db:
        if settings.app_env == "production":
            disable_demo_users(db)
        elif settings.demo_enabled:
            seed_demo_data(db)


if __name__ == "__main__":
    main()
