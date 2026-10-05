from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Employee, Organization, User
from app.services import (
    ActiveEmploymentExistsError,
    DuplicateCostCenterError,
    DuplicateEmployeeError,
    EmployeeUserNotMemberError,
    EmploymentCostCenterUnavailableError,
    InactiveEmployeeError,
    InvalidEmploymentStateError,
    create_cost_center,
    create_employee,
    create_employment,
    update_cost_center,
    update_employee,
    update_employment,
)


def get_organization(db: Session) -> Organization:
    organization = db.scalar(
        select(Organization).where(Organization.slug == "empresa-a")
    )
    assert organization is not None
    return organization


def create_test_employee(
    db: Session,
    organization: Organization,
) -> Employee:
    return create_employee(
        db,
        organization.id,
        {
            "full_name": "Funcionário para Vínculo",
            "document": "98765432100",
            "email": None,
            "phone": None,
        },
    )


def test_create_cost_center(db: Session) -> None:
    organization = get_organization(db)

    cost_center = create_cost_center(
        db,
        organization.id,
        {
            "code": "ADM",
            "name": "Administrativo",
            "description": "Despesas administrativas",
        },
    )

    assert cost_center.organization_id == organization.id
    assert cost_center.code == "ADM"
    assert cost_center.name == "Administrativo"
    assert cost_center.is_active is True


def test_create_cost_center_rejects_duplicate_and_recovers_session(
    db: Session,
) -> None:
    organization = get_organization(db)

    create_cost_center(
        db,
        organization.id,
        {
            "code": "ADM",
            "name": "Administrativo",
            "description": None,
        },
    )

    with pytest.raises(
        DuplicateCostCenterError,
        match="Já existe um centro de custo",
    ):
        create_cost_center(
            db,
            organization.id,
            {
                "code": "ADM",
                "name": "Outro departamento",
                "description": None,
            },
        )

    recovered = create_cost_center(
        db,
        organization.id,
        {
            "code": "COM",
            "name": "Comercial",
            "description": None,
        },
    )

    assert recovered.code == "COM"
    assert recovered.name == "Comercial"


def test_update_cost_center_rejects_duplicate(
    db: Session,
) -> None:
    organization = get_organization(db)

    administrative = create_cost_center(
        db,
        organization.id,
        {
            "code": "ADM",
            "name": "Administrativo",
            "description": None,
        },
    )
    commercial = create_cost_center(
        db,
        organization.id,
        {
            "code": "COM",
            "name": "Comercial",
            "description": None,
        },
    )

    with pytest.raises(DuplicateCostCenterError):
        update_cost_center(
            db,
            commercial,
            {"code": administrative.code},
        )

    db.refresh(commercial)

    assert commercial.code == "COM"


def test_create_employee_with_company_member(db: Session) -> None:
    organization = get_organization(db)
    user = db.scalar(select(User).where(User.email == "lucas@gestoria.dev"))
    assert user is not None

    employee = create_employee(
        db,
        organization.id,
        {
            "user_id": user.id,
            "full_name": "Lucas Funcionário",
            "document": "12345678901",
            "email": "lucas.funcionario@example.com",
            "phone": "35999990000",
        },
    )

    assert employee.organization_id == organization.id
    assert employee.user_id == user.id
    assert employee.full_name == "Lucas Funcionário"
    assert employee.is_active is True


def test_create_employee_rejects_user_from_another_company(
    db: Session,
) -> None:
    organization = get_organization(db)
    foreign_user = db.scalar(select(User).where(User.email == "empresa-b@gestoria.dev"))
    assert foreign_user is not None

    with pytest.raises(
        EmployeeUserNotMemberError,
        match="não pertence ou não está ativo",
    ):
        create_employee(
            db,
            organization.id,
            {
                "user_id": foreign_user.id,
                "full_name": "Usuário de Outra Empresa",
                "document": "22233344455",
                "email": None,
                "phone": None,
            },
        )


def test_employee_duplicate_document_recovers_session(
    db: Session,
) -> None:
    organization = get_organization(db)

    create_employee(
        db,
        organization.id,
        {
            "full_name": "Primeiro Funcionário",
            "document": "33344455566",
            "email": None,
            "phone": None,
        },
    )

    with pytest.raises(
        DuplicateEmployeeError,
        match="Já existe um funcionário",
    ):
        create_employee(
            db,
            organization.id,
            {
                "full_name": "Funcionário Duplicado",
                "document": "33344455566",
                "email": None,
                "phone": None,
            },
        )

    recovered = create_employee(
        db,
        organization.id,
        {
            "full_name": "Funcionário Válido",
            "document": "44455566677",
            "email": None,
            "phone": None,
        },
    )

    assert recovered.document == "44455566677"


def test_update_employee_rejects_user_from_another_company(
    db: Session,
) -> None:
    organization = get_organization(db)
    foreign_user = db.scalar(select(User).where(User.email == "empresa-b@gestoria.dev"))
    assert foreign_user is not None

    employee = create_employee(
        db,
        organization.id,
        {
            "full_name": "Funcionário sem Usuário",
            "document": "55566677788",
            "email": None,
            "phone": None,
        },
    )

    with pytest.raises(EmployeeUserNotMemberError):
        update_employee(
            db,
            employee,
            {"user_id": foreign_user.id},
        )

    db.refresh(employee)

    assert employee.user_id is None


def test_create_employment_with_cost_center(db: Session) -> None:
    organization = get_organization(db)
    employee = create_test_employee(db, organization)
    cost_center = create_cost_center(
        db,
        organization.id,
        {
            "code": "TEC",
            "name": "Tecnologia",
            "description": None,
        },
    )

    employment = create_employment(
        db,
        employee,
        {
            "cost_center_id": cost_center.id,
            "position_title": "Desenvolvedor",
            "employment_type": "employee",
            "status": "active",
            "started_at": date(2026, 1, 10),
            "ended_at": None,
            "base_salary": 3500,
            "notes": None,
        },
    )

    assert employment.organization_id == organization.id
    assert employment.employee_id == employee.id
    assert employment.cost_center_id == cost_center.id
    assert employment.status == "active"


def test_create_employment_rejects_second_current_employment(
    db: Session,
) -> None:
    organization = get_organization(db)
    employee = create_test_employee(db, organization)

    create_employment(
        db,
        employee,
        {
            "position_title": "Assistente",
            "employment_type": "employee",
            "status": "active",
            "started_at": date(2026, 1, 10),
        },
    )

    with pytest.raises(
        ActiveEmploymentExistsError,
        match="já possui um vínculo ativo",
    ):
        create_employment(
            db,
            employee,
            {
                "position_title": "Analista",
                "employment_type": "employee",
                "status": "on_leave",
                "started_at": date(2026, 2, 1),
            },
        )


def test_create_employment_rejects_foreign_cost_center(
    db: Session,
) -> None:
    organization = get_organization(db)
    employee = create_test_employee(db, organization)

    other_organization = db.scalar(
        select(Organization).where(Organization.slug == "empresa-b")
    )
    assert other_organization is not None

    foreign_cost_center = create_cost_center(
        db,
        other_organization.id,
        {
            "code": "EXT",
            "name": "Centro Externo",
            "description": None,
        },
    )

    with pytest.raises(EmploymentCostCenterUnavailableError):
        create_employment(
            db,
            employee,
            {
                "cost_center_id": foreign_cost_center.id,
                "position_title": "Analista",
                "employment_type": "employee",
                "status": "active",
                "started_at": date(2026, 1, 10),
            },
        )


def test_create_employment_rejects_inactive_employee(
    db: Session,
) -> None:
    organization = get_organization(db)
    employee = create_test_employee(db, organization)

    update_employee(
        db,
        employee,
        {"is_active": False},
    )

    with pytest.raises(InactiveEmployeeError):
        create_employment(
            db,
            employee,
            {
                "position_title": "Analista",
                "employment_type": "employee",
                "status": "active",
                "started_at": date(2026, 1, 10),
            },
        )


def test_update_employment_validates_complete_final_state(
    db: Session,
) -> None:
    organization = get_organization(db)
    employee = create_test_employee(db, organization)

    employment = create_employment(
        db,
        employee,
        {
            "position_title": "Analista",
            "employment_type": "employee",
            "status": "active",
            "started_at": date(2026, 1, 10),
        },
    )

    with pytest.raises(InvalidEmploymentStateError):
        update_employment(
            db,
            employee,
            employment,
            {"status": "ended"},
        )

    updated = update_employment(
        db,
        employee,
        employment,
        {
            "status": "ended",
            "ended_at": date(2026, 9, 30),
        },
    )

    assert updated.status == "ended"
    assert updated.ended_at == date(2026, 9, 30)
