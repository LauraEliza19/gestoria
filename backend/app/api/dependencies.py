import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import OrganizationRepository, UserRepository
from app.security import decode_access_token
from app.services import AuthenticatedUser

bearer_scheme = HTTPBearer(auto_error=False)
DatabaseSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DatabaseSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AuthenticatedUser:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        if not credentials:
            raise ValueError("Missing credentials")
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
        organization_id = uuid.UUID(payload["organization_id"])
    except (KeyError, TypeError, ValueError):
        raise unauthorized

    user = UserRepository.get_by_id(db, user_id)
    membership = UserRepository.get_membership(db, user_id, organization_id)
    organization = OrganizationRepository.get_by_id(db, organization_id)

    if not user or not user.is_active or not membership or not organization:
        raise unauthorized

    return AuthenticatedUser(user, membership, organization)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def require_role(current: AuthenticatedUser, allowed: set[str]) -> None:
    if current.membership.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não possui permissão para executar essa ação.",
        )
