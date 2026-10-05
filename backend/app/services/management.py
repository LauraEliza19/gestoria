import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import CostCenter, Employee, Employment, OrganizationMember
from app.repositories import (
    CostCenterRepository,
    EmployeeRepository,
    EmploymentRepository,
)


class ManagementServiceError(Exception):
    """Erro de regra de negócio da Gestão Interna."""


class DuplicateCostCenterError(ManagementServiceError):
    def __init__(self):
        super().__init__(
            "Já existe um centro de custo com este código ou nome nesta empresa."
        )


class DuplicateEmployeeError(ManagementServiceError):
    def __init__(self):
        super().__init__(
            "Já existe um funcionário com este documento ou usuário nesta empresa."
        )


class EmployeeUserNotMemberError(ManagementServiceError):
    def __init__(self):
        super().__init__(
            "O usuário selecionado não pertence ou não está ativo nesta empresa."
        )


class ActiveEmploymentExistsError(ManagementServiceError):
    def __init__(self):
        super().__init__(
            "O funcionário já possui um vínculo ativo ou afastado nesta empresa."
        )


class EmploymentCostCenterUnavailableError(ManagementServiceError):
    def __init__(self):
        super().__init__(
            "O centro de custo selecionado não existe ou está inativo nesta empresa."
        )


class InactiveEmployeeError(ManagementServiceError):
    def __init__(self):
        super().__init__("Não é possível criar um vínculo para um funcionário inativo.")


class InvalidEmploymentStateError(ManagementServiceError):
    def __init__(self):
        super().__init__("Os dados informados para o vínculo são inválidos.")


def _validate_employee_user(
    db: Session,
    organization_id: uuid.UUID,
    user_id: uuid.UUID | None,
) -> None:
    if user_id is None:
        return

    membership = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active.is_(True),
        )
    )

    if membership is None:
        raise EmployeeUserNotMemberError()


def create_cost_center(
    db: Session,
    organization_id: uuid.UUID,
    values: dict,
) -> CostCenter:
    try:
        return CostCenterRepository.create(
            db,
            organization_id,
            values,
        )
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateCostCenterError() from exc


def update_cost_center(
    db: Session,
    cost_center: CostCenter,
    values: dict,
) -> CostCenter:
    if not values:
        return cost_center

    try:
        return CostCenterRepository.update(
            db,
            cost_center,
            values,
        )
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateCostCenterError() from exc


def create_employee(
    db: Session,
    organization_id: uuid.UUID,
    values: dict,
) -> Employee:
    _validate_employee_user(
        db,
        organization_id,
        values.get("user_id"),
    )

    try:
        return EmployeeRepository.create(
            db,
            organization_id,
            values,
        )
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateEmployeeError() from exc


def update_employee(
    db: Session,
    employee: Employee,
    values: dict,
) -> Employee:
    if not values:
        return employee

    if "user_id" in values:
        _validate_employee_user(
            db,
            employee.organization_id,
            values["user_id"],
        )

    try:
        return EmployeeRepository.update(
            db,
            employee,
            values,
        )
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateEmployeeError() from exc


def _validate_employment_cost_center(
    db: Session,
    organization_id: uuid.UUID,
    cost_center_id: uuid.UUID | None,
) -> None:
    if cost_center_id is None:
        return

    cost_center = CostCenterRepository.get_for_organization(
        db,
        cost_center_id,
        organization_id,
    )

    if cost_center is None or not cost_center.is_active:
        raise EmploymentCostCenterUnavailableError()


def _validate_employment_state(
    values: dict,
    existing: Employment | None = None,
) -> None:
    status = values.get(
        "status",
        existing.status if existing is not None else "active",
    )
    started_at = values.get(
        "started_at",
        existing.started_at if existing is not None else None,
    )
    ended_at = values.get(
        "ended_at",
        existing.ended_at if existing is not None else None,
    )

    if started_at is None:
        raise InvalidEmploymentStateError()

    if ended_at is not None and ended_at < started_at:
        raise InvalidEmploymentStateError()

    if status == "ended" and ended_at is None:
        raise InvalidEmploymentStateError()

    if status != "ended" and ended_at is not None:
        raise InvalidEmploymentStateError()


def _validate_single_current_employment(
    db: Session,
    employee: Employee,
    status: str,
    existing: Employment | None = None,
) -> None:
    if status not in {"active", "on_leave"}:
        return

    current = EmploymentRepository.get_current_for_employee(
        db,
        employee.organization_id,
        employee.id,
    )

    if current is not None and (existing is None or current.id != existing.id):
        raise ActiveEmploymentExistsError()


def create_employment(
    db: Session,
    employee: Employee,
    values: dict,
) -> Employment:
    if not employee.is_active:
        raise InactiveEmployeeError()

    _validate_employment_state(values)
    _validate_employment_cost_center(
        db,
        employee.organization_id,
        values.get("cost_center_id"),
    )
    _validate_single_current_employment(
        db,
        employee,
        values.get("status", "active"),
    )

    try:
        return EmploymentRepository.create(
            db,
            employee.organization_id,
            employee.id,
            values,
        )
    except IntegrityError as exc:
        db.rollback()
        raise InvalidEmploymentStateError() from exc


def update_employment(
    db: Session,
    employee: Employee,
    employment: Employment,
    values: dict,
) -> Employment:
    if not values:
        return employment

    _validate_employment_state(values, existing=employment)

    if "cost_center_id" in values and values["cost_center_id"] is not None:
        _validate_employment_cost_center(
            db,
            employee.organization_id,
            values["cost_center_id"],
        )

    status = values.get("status", employment.status)
    _validate_single_current_employment(
        db,
        employee,
        status,
        existing=employment,
    )

    try:
        return EmploymentRepository.update(
            db,
            employment,
            values,
        )
    except IntegrityError as exc:
        db.rollback()
        raise InvalidEmploymentStateError() from exc
