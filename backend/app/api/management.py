import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import (
    CostCenterRepository,
    EmployeeRepository,
    ManagementOverviewRepository,
)
from app.schemas import (
    CostCenterCreate,
    CostCenterRead,
    CostCenterUpdate,
    EmployeeCreate,
    EmployeeRead,
    EmployeeSummaryRead,
    EmployeeUpdate,
    ManagementOverviewRead,
)
from app.services import (
    DuplicateCostCenterError,
    DuplicateEmployeeError,
    EmployeeUserNotMemberError,
    create_cost_center,
    create_employee,
    update_cost_center,
    update_employee,
)

router = APIRouter(
    prefix="/api/management",
    tags=["management"],
)


def cost_center_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Centro de custo não encontrado.",
    )


def duplicate_cost_center(error: DuplicateCostCenterError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=str(error),
    )


def employee_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Funcionário não encontrado.",
    )


def duplicate_employee(error: DuplicateEmployeeError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=str(error),
    )


def employee_user_unavailable(
    error: EmployeeUserNotMemberError,
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=str(error),
    )


@router.get(
    "/overview",
    response_model=ManagementOverviewRead,
)
def get_management_overview(
    db: DatabaseSession,
    current: CurrentUser,
) -> ManagementOverviewRead:
    require_role(current, {"owner", "admin"})

    return ManagementOverviewRepository.get_for_organization(
        db,
        current.organization.id,
    )


@router.get(
    "/cost-centers",
    response_model=list[CostCenterRead],
)
def list_cost_centers(
    db: DatabaseSession,
    current: CurrentUser,
    active_only: bool = False,
) -> list[CostCenterRead]:
    require_role(current, {"owner", "admin"})

    return CostCenterRepository.list_for_organization(
        db,
        current.organization.id,
        active_only=active_only,
    )


@router.get(
    "/cost-centers/{cost_center_id}",
    response_model=CostCenterRead,
)
def get_cost_center(
    cost_center_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
) -> CostCenterRead:
    require_role(current, {"owner", "admin"})

    cost_center = CostCenterRepository.get_for_organization(
        db,
        cost_center_id,
        current.organization.id,
    )

    if cost_center is None:
        raise cost_center_not_found()

    return cost_center


@router.post(
    "/cost-centers",
    response_model=CostCenterRead,
    status_code=status.HTTP_201_CREATED,
)
def create_cost_center_route(
    payload: CostCenterCreate,
    db: DatabaseSession,
    current: CurrentUser,
) -> CostCenterRead:
    require_role(current, {"owner", "admin"})

    try:
        return create_cost_center(
            db,
            current.organization.id,
            payload.model_dump(),
        )
    except DuplicateCostCenterError as exc:
        raise duplicate_cost_center(exc) from exc


@router.patch(
    "/cost-centers/{cost_center_id}",
    response_model=CostCenterRead,
)
def update_cost_center_route(
    cost_center_id: uuid.UUID,
    payload: CostCenterUpdate,
    db: DatabaseSession,
    current: CurrentUser,
) -> CostCenterRead:
    require_role(current, {"owner", "admin"})

    cost_center = CostCenterRepository.get_for_organization(
        db,
        cost_center_id,
        current.organization.id,
    )

    if cost_center is None:
        raise cost_center_not_found()

    try:
        return update_cost_center(
            db,
            cost_center,
            payload.model_dump(exclude_unset=True),
        )
    except DuplicateCostCenterError as exc:
        raise duplicate_cost_center(exc) from exc


@router.get(
    "/employees",
    response_model=list[EmployeeSummaryRead],
)
def list_employees(
    db: DatabaseSession,
    current: CurrentUser,
    active_only: bool = False,
) -> list[EmployeeSummaryRead]:
    require_role(current, {"owner", "admin"})

    return EmployeeRepository.list_for_organization(
        db,
        current.organization.id,
        active_only=active_only,
    )


@router.post(
    "/employees",
    response_model=EmployeeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_employee_route(
    payload: EmployeeCreate,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmployeeRead:
    require_role(current, {"owner", "admin"})

    try:
        return create_employee(
            db,
            current.organization.id,
            payload.model_dump(),
        )
    except DuplicateEmployeeError as exc:
        raise duplicate_employee(exc) from exc
    except EmployeeUserNotMemberError as exc:
        raise employee_user_unavailable(exc) from exc


@router.get(
    "/employees/{employee_id}",
    response_model=EmployeeRead,
)
def get_employee(
    employee_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmployeeRead:
    require_role(current, {"owner", "admin"})

    employee = EmployeeRepository.get_for_organization(
        db,
        employee_id,
        current.organization.id,
    )

    if employee is None:
        raise employee_not_found()

    return employee


@router.patch(
    "/employees/{employee_id}",
    response_model=EmployeeRead,
)
def update_employee_route(
    employee_id: uuid.UUID,
    payload: EmployeeUpdate,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmployeeRead:
    require_role(current, {"owner", "admin"})

    employee = EmployeeRepository.get_for_organization(
        db,
        employee_id,
        current.organization.id,
        for_update=True,
    )

    if employee is None:
        raise employee_not_found()

    try:
        return update_employee(
            db,
            employee,
            payload.model_dump(exclude_unset=True),
        )
    except DuplicateEmployeeError as exc:
        raise duplicate_employee(exc) from exc
    except EmployeeUserNotMemberError as exc:
        raise employee_user_unavailable(exc) from exc
