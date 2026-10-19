from fastapi import APIRouter

from app.api.dependencies import CurrentUser, DatabaseSession
from app.schemas import DashboardOverviewRead
from app.services import build_dashboard_overview

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"],
)


@router.get(
    "/overview",
    response_model=DashboardOverviewRead,
)
def get_dashboard_overview(
    db: DatabaseSession,
    current: CurrentUser,
) -> DashboardOverviewRead:
    return build_dashboard_overview(db, current)
