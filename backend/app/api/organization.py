from fastapi import APIRouter, Response, status

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import OrganizationRepository
from app.schemas import OrganizationRead, OrganizationUpdate

router = APIRouter(prefix="/api/organization", tags=["organization"])


@router.get("", response_model=OrganizationRead)
def get_organization(current: CurrentUser) -> OrganizationRead:
    return current.organization


@router.patch("", response_model=OrganizationRead)
def update_organization(
    payload: OrganizationUpdate, db: DatabaseSession, current: CurrentUser
) -> OrganizationRead:
    require_role(current, {"owner", "admin"})
    return OrganizationRepository.update(
        db, current.organization, payload.model_dump(exclude_unset=True)
    )