from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Employee, Organization, User
from app.services import (
    EmployeeRecordNotOpenError,
    InvalidEmployeeRecordStateError,
    cancel_employee_record,
    create_employee,
    create_employee_record,
    resolve_employee_record,
    update_employee_record,
)


def get_test_context(
    db: Session,
) -> tuple[Organization, User, User, User]:
    organization = db.scalar(
        select(Organization).where(Organization.slug == "empresa-a")
    )
    owner = db.scalar(select(User).where(User.email == "lucas@gestoria.dev"))
    member = db.scalar(select(User).where(User.email == "membro@gestoria.dev"))
    foreign_user = db.scalar(select(User).where(User.email == "empresa-b@gestoria.dev"))

    assert organization is not None
    assert owner is not None
    assert member is not None
    assert foreign_user is not None

    return organization, owner, member, foreign_user


def create_test_employee(
    db: Session,
    organization: Organization,
) -> Employee:
    return create_employee(
        db,
        organization.id,
        {
            "full_name": "Funcionário com Histórico",
            "document": "12312312399",
            "email": None,
            "phone": None,
        },
    )


def record_values() -> dict:
    return {
        "record_type": "warning",
        "severity": "medium",
        "title": "Advertência inicial",
        "description": "Descrição completa da advertência.",
        "occurred_at": datetime(2026, 10, 1, 10, 30, tzinfo=UTC),
    }


def test_create_and_update_employee_record(db: Session) -> None:
    organization, owner, member, _ = get_test_context(db)
    employee = create_test_employee(db, organization)

    employee_record = create_employee_record(
        db,
        employee,
        owner.id,
        record_values(),
    )

    assert employee_record.organization_id == organization.id
    assert employee_record.employee_id == employee.id
    assert employee_record.recorded_by_id == owner.id
    assert employee_record.updated_by_id == owner.id
    assert employee_record.status == "open"

    updated = update_employee_record(
        db,
        employee_record,
        member.id,
        {
            "title": "Advertência revisada",
            "severity": "high",
        },
    )

    assert updated.title == "Advertência revisada"
    assert updated.severity == "high"
    assert updated.recorded_by_id == owner.id
    assert updated.updated_by_id == member.id
    assert updated.status == "open"


def test_resolve_employee_record_and_block_further_changes(
    db: Session,
) -> None:
    organization, owner, member, _ = get_test_context(db)
    employee = create_test_employee(db, organization)

    employee_record = create_employee_record(
        db,
        employee,
        owner.id,
        record_values(),
    )

    resolved = resolve_employee_record(
        db,
        employee_record,
        member.id,
        "A situação foi analisada e encerrada.",
    )

    assert resolved.status == "resolved"
    assert resolved.resolution_notes == "A situação foi analisada e encerrada."
    assert resolved.resolved_by_id == member.id
    assert resolved.resolved_at is not None
    assert resolved.updated_by_id == member.id
    assert resolved.cancelled_by_id is None
    assert resolved.cancelled_at is None

    with pytest.raises(
        EmployeeRecordNotOpenError,
        match="Somente registros abertos",
    ):
        update_employee_record(
            db,
            resolved,
            owner.id,
            {"title": "Alteração indevida"},
        )

    with pytest.raises(EmployeeRecordNotOpenError):
        cancel_employee_record(
            db,
            resolved,
            owner.id,
            "Tentativa de cancelamento posterior.",
        )


def test_cancel_employee_record_and_block_further_changes(
    db: Session,
) -> None:
    organization, owner, member, _ = get_test_context(db)
    employee = create_test_employee(db, organization)

    employee_record = create_employee_record(
        db,
        employee,
        owner.id,
        record_values(),
    )

    cancelled = cancel_employee_record(
        db,
        employee_record,
        member.id,
        "Registro criado para o funcionário incorreto.",
    )

    assert cancelled.status == "cancelled"
    assert (
        cancelled.cancellation_reason == "Registro criado para o funcionário incorreto."
    )
    assert cancelled.cancelled_by_id == member.id
    assert cancelled.cancelled_at is not None
    assert cancelled.updated_by_id == member.id
    assert cancelled.resolved_by_id is None
    assert cancelled.resolved_at is None

    with pytest.raises(EmployeeRecordNotOpenError):
        resolve_employee_record(
            db,
            cancelled,
            owner.id,
            "Tentativa de resolução posterior.",
        )


def test_create_employee_record_rejects_foreign_actor_and_recovers_session(
    db: Session,
) -> None:
    organization, owner, _, foreign_user = get_test_context(db)
    employee = create_test_employee(db, organization)

    with pytest.raises(
        InvalidEmployeeRecordStateError,
        match="Não foi possível salvar",
    ):
        create_employee_record(
            db,
            employee,
            foreign_user.id,
            record_values(),
        )

    recovered = create_employee_record(
        db,
        employee,
        owner.id,
        record_values(),
    )

    assert recovered.id is not None
    assert recovered.recorded_by_id == owner.id
    assert recovered.status == "open"
