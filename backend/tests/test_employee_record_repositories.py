from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Organization, User
from app.repositories import EmployeeRecordRepository, EmployeeRepository


def get_test_context(
    db: Session,
) -> tuple[Organization, Organization, User, User, User]:
    organization_a = db.scalar(
        select(Organization).where(Organization.slug == "empresa-a")
    )
    organization_b = db.scalar(
        select(Organization).where(Organization.slug == "empresa-b")
    )
    owner_a = db.scalar(select(User).where(User.email == "lucas@gestoria.dev"))
    member_a = db.scalar(select(User).where(User.email == "membro@gestoria.dev"))
    owner_b = db.scalar(select(User).where(User.email == "empresa-b@gestoria.dev"))

    assert organization_a is not None
    assert organization_b is not None
    assert owner_a is not None
    assert member_a is not None
    assert owner_b is not None

    return organization_a, organization_b, owner_a, member_a, owner_b


def employee_record_values(
    *,
    record_type: str = "warning",
    severity: str = "medium",
    title: str = "Advertência registrada",
    occurred_at: datetime | None = None,
) -> dict:
    return {
        "record_type": record_type,
        "severity": severity,
        "status": "open",
        "title": title,
        "description": "Descrição detalhada do registro do funcionário.",
        "occurred_at": occurred_at or datetime(2026, 10, 1, 9, 30, tzinfo=UTC),
    }


def test_employee_record_repository_create_list_filter_and_update(
    db: Session,
) -> None:
    organization_a, _, owner_a, member_a, _ = get_test_context(db)

    employee = EmployeeRepository.create(
        db,
        organization_a.id,
        {
            "full_name": "Maria da Silva",
            "document": "12345678901",
        },
    )

    older_record = EmployeeRecordRepository.create(
        db,
        organization_a.id,
        employee.id,
        owner_a.id,
        employee_record_values(),
    )
    newer_record = EmployeeRecordRepository.create(
        db,
        organization_a.id,
        employee.id,
        owner_a.id,
        employee_record_values(
            record_type="commendation",
            severity="informational",
            title="Reconhecimento profissional",
            occurred_at=datetime(2026, 10, 2, 14, 0, tzinfo=UTC),
        ),
    )

    records = EmployeeRecordRepository.list_for_employee(
        db,
        organization_a.id,
        employee.id,
    )

    assert [item.id for item in records] == [
        newer_record.id,
        older_record.id,
    ]

    warnings = EmployeeRecordRepository.list_for_employee(
        db,
        organization_a.id,
        employee.id,
        record_type="warning",
    )
    assert [item.id for item in warnings] == [older_record.id]

    open_records = EmployeeRecordRepository.list_for_employee(
        db,
        organization_a.id,
        employee.id,
        status="open",
    )
    assert {item.id for item in open_records} == {
        older_record.id,
        newer_record.id,
    }

    updated = EmployeeRecordRepository.update(
        db,
        older_record,
        member_a.id,
        {
            "title": "Advertência revisada",
            "severity": "high",
        },
    )

    assert updated.title == "Advertência revisada"
    assert updated.severity == "high"
    assert updated.recorded_by_id == owner_a.id
    assert updated.updated_by_id == member_a.id


def test_employee_record_repository_preserves_tenant_isolation(
    db: Session,
) -> None:
    organization_a, organization_b, owner_a, _, _ = get_test_context(db)

    employee_a = EmployeeRepository.create(
        db,
        organization_a.id,
        {
            "full_name": "Funcionário da Empresa A",
            "document": "11122233344",
        },
    )
    employee_b = EmployeeRepository.create(
        db,
        organization_b.id,
        {
            "full_name": "Funcionário da Empresa B",
            "document": "55566677788",
        },
    )

    employee_record = EmployeeRecordRepository.create(
        db,
        organization_a.id,
        employee_a.id,
        owner_a.id,
        employee_record_values(),
    )

    hidden_record = EmployeeRecordRepository.get_for_organization(
        db,
        employee_record.id,
        organization_b.id,
    )
    assert hidden_record is None

    foreign_employee_records = EmployeeRecordRepository.list_for_employee(
        db,
        organization_a.id,
        employee_b.id,
    )
    assert foreign_employee_records == []


def test_employee_record_repository_rejects_cross_tenant_relations(
    db: Session,
) -> None:
    organization_a, organization_b, owner_a, _, owner_b = get_test_context(db)

    employee_a = EmployeeRepository.create(
        db,
        organization_a.id,
        {
            "full_name": "Funcionário Local",
            "document": "99988877766",
        },
    )
    employee_b = EmployeeRepository.create(
        db,
        organization_b.id,
        {
            "full_name": "Funcionário Externo",
            "document": "44433322211",
        },
    )

    with pytest.raises(IntegrityError):
        EmployeeRecordRepository.create(
            db,
            organization_a.id,
            employee_b.id,
            owner_a.id,
            employee_record_values(),
        )
    db.rollback()

    with pytest.raises(IntegrityError):
        EmployeeRecordRepository.create(
            db,
            organization_a.id,
            employee_a.id,
            owner_b.id,
            employee_record_values(),
        )
    db.rollback()
