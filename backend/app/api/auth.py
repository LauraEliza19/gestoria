from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import CurrentUser, DatabaseSession
from app.schemas import CurrentUserRead, LoginRequest, OrganizationRead, TokenRead
from app.security import create_access_token
from app.services import authenticate

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/login", response_model=TokenRead)
def login(payload: LoginRequest, db: DatabaseSession) -> TokenRead:
    authenticated = authenticate(db, str(payload.email), payload.password)
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos.",
        )

    token = create_access_token(
        str(authenticated.user.id), str(authenticated.organization.id)
    )
    return TokenRead(access_token=token)


@router.get("/me", response_model=CurrentUserRead)
def get_me(current: CurrentUser) -> CurrentUserRead:
    return CurrentUserRead(
        id=current.user.id,
        full_name=current.user.full_name,
        email=current.user.email,
        role=current.membership.role,
        organization=OrganizationRead.model_validate(current.organization),
    )
