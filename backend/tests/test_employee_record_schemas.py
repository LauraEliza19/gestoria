from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.schemas import (
    EmployeeRecordCancel,
    EmployeeRecordCreate,
    EmployeeRecordResolve,
    EmployeeRecordUpdate,
)


def valid_payload() -> dict:
    return {
        "record_type": "warning",
        "severity": "medium",
        "title": " Atraso recorrente ",
        "description": " Funcionário chegou atrasado sem justificativa. ",
        "occurred_at": "2026-10-05T10:00:00-03:00",
    }


def test_employee_record_create_normalizes_values() -> None:
    record = EmployeeRecordCreate(**valid_payload())

    assert record.record_type == "warning"
    assert record.severity == "medium"
    assert record.title == "Atraso recorrente"
    assert record.description == ("Funcionário chegou atrasado sem justificativa.")
    assert record.occurred_at == datetime(
        2026,
        10,
        5,
        13,
        0,
        tzinfo=UTC,
    )


def test_employee_record_create_uses_default_severity() -> None:
    payload = valid_payload()
    payload.pop("severity")

    record = EmployeeRecordCreate(**payload)

    assert record.severity == "informational"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("record_type", "unsupported"),
        ("severity", "critical"),
    ],
)
def test_employee_record_rejects_invalid_classification(
    field: str,
    value: str,
) -> None:
    payload = valid_payload()
    payload[field] = value

    with pytest.raises(ValidationError):
        EmployeeRecordCreate(**payload)


def test_employee_record_rejects_naive_datetime() -> None:
    payload = valid_payload()
    payload["occurred_at"] = "2026-10-05T10:00:00"

    with pytest.raises(
        ValidationError,
        match="deve possuir fuso horário",
    ):
        EmployeeRecordCreate(**payload)


def test_employee_record_rejects_future_datetime() -> None:
    payload = valid_payload()
    payload["occurred_at"] = (datetime.now(UTC) + timedelta(minutes=5)).isoformat()

    with pytest.raises(
        ValidationError,
        match="não pode estar no futuro",
    ):
        EmployeeRecordCreate(**payload)


def test_employee_record_update_requires_a_change() -> None:
    with pytest.raises(
        ValidationError,
        match="ao menos um campo",
    ):
        EmployeeRecordUpdate()


def test_employee_record_update_accepts_partial_changes() -> None:
    update = EmployeeRecordUpdate(
        title=" Registro atualizado ",
    )

    assert update.title == "Registro atualizado"
    assert update.model_fields_set == {"title"}


def test_employee_record_resolution_requires_notes() -> None:
    with pytest.raises(ValidationError):
        EmployeeRecordResolve(resolution_notes="   ")


def test_employee_record_cancellation_requires_reason() -> None:
    with pytest.raises(ValidationError):
        EmployeeRecordCancel(cancellation_reason="x")
