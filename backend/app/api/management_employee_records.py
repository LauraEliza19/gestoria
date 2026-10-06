import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import EmployeeRecordRepository, EmployeeRepository
from app.schemas import (
    EmployeeRecordCancel,
    EmployeeRecordCreate,
    EmployeeRecordRead,
    EmployeeRecordResolve,
    EmployeeRecordSummaryRead,
    EmployeeRecordUpdate,
)
from app.schemas.management import EmployeeRecordStatus, EmployeeRecordType
from app.services import (
    EmployeeRecordNotOpenError,
    InvalidEmployeeRecordStateError,
    cancel_employee_record,
    create_employee_record,
    resolve_employee_record,
    update_employee_record,
)

router = APIRouter(
    prefix="/api/management",
    tags=["management"],
)

EmployeeRecordStatusFilter = Annotated[
    EmployeeRecordStatus | None,
    Query(alias="status"),
]


def employee_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Funcionário não encontrado.",
    )


def employee_record_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Registro do funcionário não encontrado.",
    )


def employee_record_conflict(
    error: EmployeeRecordNotOpenError,
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=str(error),
    )


def invalid_employee_record(
    error: InvalidEmployeeRecordStateError,
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=str(error),
    )


@router.get(
    "/employees/{employee_id}/records",
    response_model=list[EmployeeRecordSummaryRead],
)
def list_employee_records(
    employee_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
    record_status: EmployeeRecordStatusFilter = None,
    record_type: EmployeeRecordType | None = None,
) -> list[EmployeeRecordSummaryRead]:
    require_role(current, {"owner", "admin"})

    employee = EmployeeRepository.get_for_organization(
        db,
        employee_id,
        current.organization.id,
    )

    if employee is None:
        raise employee_not_found()

    return EmployeeRecordRepository.list_for_employee(
        db,
        current.organization.id,
        employee.id,
        status=record_status,
        record_type=record_type,
    )


@router.post(
    "/employees/{employee_id}/records",
    response_model=EmployeeRecordRead,
    status_code=status.HTTP_201_CREATED,
)
def create_employee_record_route(
    employee_id: uuid.UUID,
    payload: EmployeeRecordCreate,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmployeeRecordRead:
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
        return create_employee_record(
            db,
            employee,
            current.user.id,
            payload.model_dump(),
        )
    except InvalidEmployeeRecordStateError as exc:
        raise invalid_employee_record(exc) from exc


@router.get(
    "/employee-records/{record_id}",
    response_model=EmployeeRecordRead,
)
def get_employee_record(
    record_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmployeeRecordRead:
    require_role(current, {"owner", "admin"})

    employee_record = EmployeeRecordRepository.get_for_organization(
        db,
        record_id,
        current.organization.id,
    )

    if employee_record is None:
        raise employee_record_not_found()

    return employee_record


@router.patch(
    "/employee-records/{record_id}",
    response_model=EmployeeRecordRead,
)
def update_employee_record_route(
    record_id: uuid.UUID,
    payload: EmployeeRecordUpdate,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmployeeRecordRead:
    require_role(current, {"owner", "admin"})

    employee_record = EmployeeRecordRepository.get_for_organization(
        db,
        record_id,
        current.organization.id,
        for_update=True,
    )

    if employee_record is None:
        raise employee_record_not_found()

    try:
        return update_employee_record(
            db,
            employee_record,
            current.user.id,
            payload.model_dump(exclude_unset=True),
        )
    except EmployeeRecordNotOpenError as exc:
        raise employee_record_conflict(exc) from exc
    except InvalidEmployeeRecordStateError as exc:
        raise invalid_employee_record(exc) from exc


@router.post(
    "/employee-records/{record_id}/resolve",
    response_model=EmployeeRecordRead,
)
def resolve_employee_record_route(
    record_id: uuid.UUID,
    payload: EmployeeRecordResolve,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmployeeRecordRead:
    require_role(current, {"owner", "admin"})

    employee_record = EmployeeRecordRepository.get_for_organization(
        db,
        record_id,
        current.organization.id,
        for_update=True,
    )

    if employee_record is None:
        raise employee_record_not_found()

    try:
        return resolve_employee_record(
            db,
            employee_record,
            current.user.id,
            payload.resolution_notes,
        )
    except EmployeeRecordNotOpenError as exc:
        raise employee_record_conflict(exc) from exc
    except InvalidEmployeeRecordStateError as exc:
        raise invalid_employee_record(exc) from exc


@router.post(
    "/employee-records/{record_id}/cancel",
    response_model=EmployeeRecordRead,
)
def cancel_employee_record_route(
    record_id: uuid.UUID,
    payload: EmployeeRecordCancel,
    db: DatabaseSession,
    current: CurrentUser,
) -> EmployeeRecordRead:
    require_role(current, {"owner", "admin"})

    employee_record = EmployeeRecordRepository.get_for_organization(
        db,
        record_id,
        current.organization.id,
        for_update=True,
    )

    if employee_record is None:
        raise employee_record_not_found()

    try:
        return cancel_employee_record(
            db,
            employee_record,
            current.user.id,
            payload.cancellation_reason,
        )
    except EmployeeRecordNotOpenError as exc:
        raise employee_record_conflict(exc) from exc
    except InvalidEmployeeRecordStateError as exc:
        raise invalid_employee_record(exc) from exc
