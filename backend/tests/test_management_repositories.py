from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Organization, User
from app.repositories import (
    CostCenterRepository,
    EmployeeRepository,
    EmploymentRepository,
)


def get_organizations(db: Session) -> tuple[Organization, Organization]:
    organization_a = db.scalar(
        select(Organization).where(Organization.slug == "empresa-a")
    )
    organization_b = db.scalar(
        select(Organization).where(Organization.slug == "empresa-b")
    )

    assert organization_a is not None
    assert organization_b is not None

    return organization_a, organization_b


def test_cost_centers_are_isolated_by_organization(db: Session) -> None:
    organization_a, organization_b = get_organizations(db)

    cost_center_a = CostCenterRepository.create(
        db,
        organization_a.id,
        {
            "code": "ADM",
            "name": "Administrativo",
            "description": "Empresa A",
        },
    )
    cost_center_b = CostCenterRepository.create(
        db,
        organization_b.id,
        {
            "code": "ADM",
            "name": "Administrativo",
            "description": "Empresa B",
        },
    )

    organization_a_items = CostCenterRepository.list_for_organization(
        db,
        organization_a.id,
    )

    assert [item.id for item in organization_a_items] == [cost_center_a.id]
    assert cost_center_b.id not in {item.id for item in organization_a_items}

    assert (
        CostCenterRepository.get_for_organization(
            db,
            cost_center_b.id,
            organization_a.id,
        )
        is None
    )


def test_cost_center_repository_filters_inactive_records(db: Session) -> None:
    organization_a, _ = get_organizations(db)

    cost_center = CostCenterRepository.create(
        db,
        organization_a.id,
        {
            "code": "PROD",
            "name": "Produção",
            "description": None,
        },
    )

    CostCenterRepository.update(
        db,
        cost_center,
        {"is_active": False},
    )

    active_items = CostCenterRepository.list_for_organization(
        db,
        organization_a.id,
        active_only=True,
    )
    all_items = CostCenterRepository.list_for_organization(
        db,
        organization_a.id,
    )

    assert active_items == []
    assert [item.id for item in all_items] == [cost_center.id]
    assert all_items[0].is_active is False


def test_employees_are_isolated_by_organization(db: Session) -> None:
    organization_a, organization_b = get_organizations(db)

    user_a = db.scalar(select(User).where(User.email == "lucas@gestoria.dev"))
    user_b = db.scalar(select(User).where(User.email == "empresa-b@gestoria.dev"))

    assert user_a is not None
    assert user_b is not None

    employee_a = EmployeeRepository.create(
        db,
        organization_a.id,
        {
            "user_id": user_a.id,
            "full_name": "Funcionário Empresa A",
            "document": "12345678901",
            "email": "funcionario-a@example.com",
            "phone": "35999990000",
        },
    )
    employee_b = EmployeeRepository.create(
        db,
        organization_b.id,
        {
            "user_id": user_b.id,
            "full_name": "Funcionário Empresa B",
            "document": "12345678901",
            "email": "funcionario-b@example.com",
            "phone": "35988880000",
        },
    )

    organization_a_items = EmployeeRepository.list_for_organization(
        db,
        organization_a.id,
    )

    assert [item.id for item in organization_a_items] == [employee_a.id]
    assert employee_b.id not in {item.id for item in organization_a_items}
    assert employee_a.user_id == user_a.id

    assert (
        EmployeeRepository.get_for_organization(
            db,
            employee_b.id,
            organization_a.id,
        )
        is None
    )


def test_employee_repository_filters_inactive_records(db: Session) -> None:
    organization_a, _ = get_organizations(db)

    employee = EmployeeRepository.create(
        db,
        organization_a.id,
        {
            "full_name": "Funcionário Inativo",
            "document": "98765432100",
            "email": None,
            "phone": None,
        },
    )

    EmployeeRepository.update(
        db,
        employee,
        {"is_active": False},
    )

    active_items = EmployeeRepository.list_for_organization(
        db,
        organization_a.id,
        active_only=True,
    )
    all_items = EmployeeRepository.list_for_organization(
        db,
        organization_a.id,
    )

    assert active_items == []
    assert [item.id for item in all_items] == [employee.id]
    assert all_items[0].is_active is False


def test_employment_repository_preserves_history_and_current(
    db: Session,
) -> None:
    organization_a, _ = get_organizations(db)

    employee = EmployeeRepository.create(
        db,
        organization_a.id,
        {
            "full_name": "Funcionário com Histórico",
            "document": "11122233344",
            "email": None,
            "phone": None,
        },
    )
    cost_center = CostCenterRepository.create(
        db,
        organization_a.id,
        {
            "code": "TEC",
            "name": "Tecnologia",
            "description": None,
        },
    )

    previous_employment = EmploymentRepository.create(
        db,
        organization_a.id,
        employee.id,
        {
            "cost_center_id": cost_center.id,
            "position_title": "Assistente",
            "employment_type": "employee",
            "status": "ended",
            "started_at": date(2025, 1, 1),
            "ended_at": date(2025, 12, 31),
            "base_salary": Decimal("1800.00"),
            "notes": None,
        },
    )
    current_employment = EmploymentRepository.create(
        db,
        organization_a.id,
        employee.id,
        {
            "cost_center_id": cost_center.id,
            "position_title": "Analista",
            "employment_type": "employee",
            "status": "active",
            "started_at": date(2026, 1, 1),
            "ended_at": None,
            "base_salary": Decimal("2500.00"),
            "notes": None,
        },
    )

    history = EmploymentRepository.list_for_employee(
        db,
        organization_a.id,
        employee.id,
    )
    current = EmploymentRepository.get_current_for_employee(
        db,
        organization_a.id,
        employee.id,
    )

    assert [item.id for item in history] == [
        current_employment.id,
        previous_employment.id,
    ]
    assert current is not None
    assert current.id == current_employment.id
    assert current.position_title == "Analista"


def test_employment_rejects_cost_center_from_another_organization(
    db: Session,
) -> None:
    organization_a, organization_b = get_organizations(db)

    employee = EmployeeRepository.create(
        db,
        organization_a.id,
        {
            "full_name": "Funcionário Empresa A",
            "document": "55566677788",
            "email": None,
            "phone": None,
        },
    )
    foreign_cost_center = CostCenterRepository.create(
        db,
        organization_b.id,
        {
            "code": "EXT",
            "name": "Centro Externo",
            "description": None,
        },
    )

    with pytest.raises(IntegrityError):
        EmploymentRepository.create(
            db,
            organization_a.id,
            employee.id,
            {
                "cost_center_id": foreign_cost_center.id,
                "position_title": "Analista",
                "employment_type": "employee",
                "status": "active",
                "started_at": date(2026, 1, 1),
                "ended_at": None,
                "base_salary": Decimal("2500.00"),
                "notes": None,
            },
        )

    db.rollback()
