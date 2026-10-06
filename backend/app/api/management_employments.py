import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import EmployeeRepository, EmploymentRepository
from app.schemas import (
    EmploymentCompensationRead,
    EmploymentCreate,
    EmploymentRead,
    EmploymentUpdate,
)
from app.services import (
    ActiveEmploymentExistsError,
    EmploymentCostCenterUnavailableError,
    InactiveEmployeeError,
    InvalidEmploymentStateError,
    create_employment,
    update_employment,
)

router = APIRouter(
    prefix="/api/management",
    tags=["management"],
)


def employee_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Funcionário não encontrado.",
    )


def employment_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Vínculo profissional não encontrado.",
    )


def employment_conflict(
    error: ActiveEmploymentExistsError | InactiveEmployeeError,
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=str(error),
    )


def invalid_employment(
    error: EmploymentCostCenterUnavailableError | InvalidEmploymentStateError,
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=str(error),
    )


@router.get(
    "/employees/{employee_id}/employments",
    response_model=list[EmploymentRead],
)
def list_employments(
    employee_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
) -> list[EmploymentRead]:
    require_role(current, {"owner", "admin"})

    employee = EmployeeRepository.get_for_organization(
        db,
        employee_id,
        current.organization.id,
    )

    if employee is None:
        raise employee_not_found()

    return EmploymentRepository.list_for_employee(
        db,
        current.organization.id,
        employee.id,
    )


@router.post(
    "/employees/{employee_id}/employments",
    response_model=EmploymentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_employment_route(
    employee_id: uuid.UUID,
    payload: EmploymentCreate,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmploymentRead:
    require_role(current, {"owner", "admin"})

    employee = EmployeeRepository.get_for_organization(
        db,
        employee_id,
        current.organization.id,
        for_update=True,
    )

    if employee is None:
        raise employee_not_found()

    values = payload.model_dump(exclude_unset=True)

    if "base_salary" in values:
        require_role(current, {"owner"})

    try:
        return create_employment(
            db,
            employee,
            values,
        )
    except ActiveEmploymentExistsError as exc:
        raise employment_conflict(exc) from exc
    except InactiveEmployeeError as exc:
        raise employment_conflict(exc) from exc
    except (
        EmploymentCostCenterUnavailableError,
        InvalidEmploymentStateError,
    ) as exc:
        raise invalid_employment(exc) from exc


@router.patch(
    "/employments/{employment_id}",
    response_model=EmploymentRead,
)
def update_employment_route(
    employment_id: uuid.UUID,
    payload: EmploymentUpdate,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmploymentRead:
    require_role(current, {"owner", "admin"})

    employment = EmploymentRepository.get_for_organization(
        db,
        employment_id,
        current.organization.id,
        for_update=True,
    )

    if employment is None:
        raise employment_not_found()

    employee = EmployeeRepository.get_for_organization(
        db,
        employment.employee_id,
        current.organization.id,
        for_update=True,
    )

    if employee is None:
        raise employee_not_found()

    values = payload.model_dump(exclude_unset=True)

    if "base_salary" in values:
        require_role(current, {"owner"})

    try:
        return update_employment(
            db,
            employee,
            employment,
            values,
        )
    except ActiveEmploymentExistsError as exc:
        raise employment_conflict(exc) from exc
    except (
        EmploymentCostCenterUnavailableError,
        InvalidEmploymentStateError,
    ) as exc:
        raise invalid_employment(exc) from exc


@router.get(
    "/employments/{employment_id}/compensation",
    response_model=EmploymentCompensationRead,
)
def get_employment_compensation(
    employment_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmploymentCompensationRead:
    require_role(current, {"owner"})

    employment = EmploymentRepository.get_for_organization(
        db,
        employment_id,
        current.organization.id,
    )

    if employment is None:
        raise employment_not_found()

    return employment
