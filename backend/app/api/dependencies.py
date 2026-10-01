from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.services import AuthenticatedUser
from app.services.sessions import find_session, session_user

DatabaseSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DatabaseSession, request: Request) -> AuthenticatedUser:
    session = find_session(db, request.cookies.get(settings.session_cookie_name))
    return session_user(db, session)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def require_role(current: AuthenticatedUser, allowed: set[str]) -> None:
    if current.membership.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não possui permissão para executar essa ação.",
        )
