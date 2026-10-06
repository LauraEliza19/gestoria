from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas import (
    CostCenterCreate,
    EmployeeCreate,
    EmploymentCreate,
)


def test_cost_center_normalizes_code_and_text() -> None:
    cost_center = CostCenterCreate(
        code=" adm ",
        name=" Administração ",
        description=" Área administrativa ",
    )

    assert cost_center.code == "ADM"
    assert cost_center.name == "Administração"
    assert cost_center.description == "Área administrativa"


def test_employee_normalizes_personal_data() -> None:
    employee = EmployeeCreate(
        full_name=" Maria Silva ",
        document="123.456.789-01",
        email="MARIA@EXAMPLE.COM",
        phone="(35) 99999-0000",
    )

    assert employee.full_name == "Maria Silva"
    assert employee.document == "12345678901"
    assert employee.email == "maria@example.com"
    assert employee.phone == "35999990000"


def test_employee_rejects_future_birth_date() -> None:
    tomorrow = datetime.now(UTC).date() + timedelta(days=1)

    with pytest.raises(
        ValidationError,
        match="A data de nascimento não pode estar no futuro",
    ):
        EmployeeCreate(
            full_name="Pessoa do Futuro",
            birth_date=tomorrow,
        )


def test_employment_accepts_active_contract() -> None:
    employment = EmploymentCreate(
        position_title=" Analista ",
        started_at=date(2026, 10, 5),
        base_salary="2500.00",
    )

    assert employment.position_title == "Analista"
    assert employment.employment_type == "employee"
    assert employment.status == "active"
    assert employment.base_salary == Decimal("2500.00")


@pytest.mark.parametrize(
    "payload",
    [
        {
            "position_title": "Analista",
            "started_at": date(2026, 10, 5),
            "status": "ended",
        },
        {
            "position_title": "Analista",
            "started_at": date(2026, 10, 5),
            "ended_at": date(2026, 10, 6),
        },
        {
            "position_title": "Analista",
            "started_at": date(2026, 10, 5),
            "status": "ended",
            "ended_at": date(2026, 10, 4),
        },
        {
            "position_title": "Analista",
            "started_at": date(2026, 10, 5),
            "base_salary": "-1.00",
        },
    ],
)
def test_employment_rejects_inconsistent_data(payload: dict) -> None:
    with pytest.raises(ValidationError):
        EmploymentCreate(**payload)
