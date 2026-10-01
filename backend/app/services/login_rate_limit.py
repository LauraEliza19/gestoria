import time
from hashlib import sha256

from fastapi import HTTPException
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.config import settings
from app.models.auth_session import LoginRateLimit


def consume_login_attempt(db: Session, scope: str, value: str, limit: int):
    now = int(time.time())
    window = now // settings.login_window_seconds
    key = sha256(f"{scope}:{value}".encode()).hexdigest()
    insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    statement = insert(LoginRateLimit).values(key=key, window=window, attempts=1)
    statement = statement.on_conflict_do_update(
        index_elements=["key", "window"],
        set_={"attempts": LoginRateLimit.attempts + 1},
    ).returning(LoginRateLimit.attempts)
    attempts = db.scalar(statement)
    db.execute(delete(LoginRateLimit).where(LoginRateLimit.window < window - 1))
    db.commit()
    if attempts > limit:
        raise HTTPException(
            429,
            "Muitas tentativas de login. Aguarde e tente novamente.",
            headers={
                "Retry-After": str(
                    settings.login_window_seconds - now % settings.login_window_seconds
                )
            },
        )
