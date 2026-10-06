from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_api import login

from app.models import OrganizationMember, User

EMPLOYEES_URL = "/api/management/employees"
RECORDS_URL = "/api/management/employee-records"


def create_employee(
    client: TestClient,
    headers: dict[str, str],
    *,
    document: str = "12345678901",
) -> dict:
    response = client.post(
        EMPLOYEES_URL,
        headers=headers,
        json={
            "full_name": "Funcionário com Ocorrências",
            "document": document,
        },
    )

    assert response.status_code == 201
    return response.json()


def create_record(
    client: TestClient,
    headers: dict[str, str],
    employee_id: str,
    *,
    record_type: str = "warning",
    severity: str = "medium",
    title: str = "Advertência inicial",
    occurred_at: str = "2026-10-01T10:30:00-03:00",
) -> dict:
    response = client.post(
        f"{EMPLOYEES_URL}/{employee_id}/records",
        headers=headers,
        json={
            "record_type": record_type,
            "severity": severity,
            "title": title,
            "description": "Descrição completa do registro do funcionário.",
            "occurred_at": occurred_at,
        },
    )

    assert response.status_code == 201
    return response.json()


def test_employee_record_api_complete_flow(
    client: TestClient,
) -> None:
    owner_headers = login(client)
    employee = create_employee(client, owner_headers)

    warning = create_record(
        client,
        owner_headers,
        employee["id"],
    )
    commendation = create_record(
        client,
        owner_headers,
        employee["id"],
        record_type="commendation",
        severity="informational",
        title="Reconhecimento profissional",
        occurred_at="2026-10-02T14:00:00-03:00",
    )

    assert warning["employee_id"] == employee["id"]
    assert warning["status"] == "open"
    assert warning["record_type"] == "warning"
    assert warning["severity"] == "medium"
    assert warning["recorded_by_id"] == warning["updated_by_id"]

    records_url = f"{EMPLOYEES_URL}/{employee['id']}/records"

    listed = client.get(
        records_url,
        headers=owner_headers,
    )
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [
        commendation["id"],
        warning["id"],
    ]

    summary = listed.json()[0]
    assert "description" not in summary
    assert "recorded_by_id" not in summary
    assert "resolution_notes" not in summary
    assert "cancellation_reason" not in summary

    filtered = client.get(
        f"{records_url}?record_type=warning&status=open",
        headers=owner_headers,
    )
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()] == [warning["id"]]

    detail = client.get(
        f"{RECORDS_URL}/{warning['id']}",
        headers=owner_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["description"] == (
        "Descrição completa do registro do funcionário."
    )

    updated = client.patch(
        f"{RECORDS_URL}/{warning['id']}",
        headers=owner_headers,
        json={
            "title": "Advertência revisada",
            "severity": "high",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Advertência revisada"
    assert updated.json()["severity"] == "high"
    assert updated.json()["status"] == "open"

    resolved = client.post(
        f"{RECORDS_URL}/{warning['id']}/resolve",
        headers=owner_headers,
        json={
            "resolution_notes": "A situação foi analisada e encerrada.",
        },
    )
    assert resolved.status_code == 200

    resolved_record = resolved.json()
    assert resolved_record["status"] == "resolved"
    assert (
        resolved_record["resolution_notes"] == "A situação foi analisada e encerrada."
    )
    assert resolved_record["resolved_by_id"] is not None
    assert resolved_record["resolved_at"] is not None
    assert resolved_record["cancelled_by_id"] is None

    resolved_list = client.get(
        f"{records_url}?status=resolved",
        headers=owner_headers,
    )
    assert resolved_list.status_code == 200
    assert [item["id"] for item in resolved_list.json()] == [warning["id"]]

    forbidden_update = client.patch(
        f"{RECORDS_URL}/{warning['id']}",
        headers=owner_headers,
        json={"title": "Alteração posterior"},
    )
    assert forbidden_update.status_code == 409
    assert "Somente registros abertos" in forbidden_update.json()["detail"]

    forbidden_cancel = client.post(
        f"{RECORDS_URL}/{warning['id']}/cancel",
        headers=owner_headers,
        json={"cancellation_reason": "Tentativa posterior."},
    )
    assert forbidden_cancel.status_code == 409


def test_employee_record_api_cancel_and_permissions(
    client: TestClient,
    db: Session,
) -> None:
    owner_headers = login(client)
    member_headers = login(
        client,
        "membro@gestoria.dev",
    )

    employee = create_employee(
        client,
        owner_headers,
        document="22233344455",
    )
    employee_record = create_record(
        client,
        owner_headers,
        employee["id"],
        record_type="incident",
        severity="low",
        title="Ocorrência operacional",
    )

    records_url = f"{EMPLOYEES_URL}/{employee['id']}/records"

    assert (
        client.get(
            records_url,
            headers=member_headers,
        ).status_code
        == 403
    )
    assert (
        client.post(
            records_url,
            headers=member_headers,
            json={
                "record_type": "note",
                "severity": "informational",
                "title": "Tentativa sem permissão",
                "description": "Conteúdo da tentativa sem permissão.",
                "occurred_at": "2026-10-01T10:30:00-03:00",
            },
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"{RECORDS_URL}/{employee_record['id']}",
            headers=member_headers,
        ).status_code
        == 403
    )

    admin_user = db.scalar(select(User).where(User.email == "membro@gestoria.dev"))
    assert admin_user is not None

    membership = db.scalar(
        select(OrganizationMember).where(OrganizationMember.user_id == admin_user.id)
    )
    assert membership is not None

    membership.role = "admin"
    db.commit()

    admin_headers = login(
        client,
        "membro@gestoria.dev",
    )

    admin_list = client.get(
        records_url,
        headers=admin_headers,
    )
    assert admin_list.status_code == 200
    assert [item["id"] for item in admin_list.json()] == [employee_record["id"]]

    cancelled = client.post(
        f"{RECORDS_URL}/{employee_record['id']}/cancel",
        headers=admin_headers,
        json={"cancellation_reason": "Registro criado para o funcionário incorreto."},
    )
    assert cancelled.status_code == 200

    cancelled_record = cancelled.json()
    assert cancelled_record["status"] == "cancelled"
    assert cancelled_record["cancelled_by_id"] == str(admin_user.id)
    assert cancelled_record["cancelled_at"] is not None
    assert (
        cancelled_record["cancellation_reason"]
        == "Registro criado para o funcionário incorreto."
    )

    repeated_cancel = client.post(
        f"{RECORDS_URL}/{employee_record['id']}/cancel",
        headers=admin_headers,
        json={"cancellation_reason": "Nova tentativa de cancelamento."},
    )
    assert repeated_cancel.status_code == 409

    forbidden_resolve = client.post(
        f"{RECORDS_URL}/{employee_record['id']}/resolve",
        headers=admin_headers,
        json={"resolution_notes": "Tentativa posterior."},
    )
    assert forbidden_resolve.status_code == 409


def test_employee_records_are_isolated_between_companies(
    client: TestClient,
) -> None:
    company_a_headers = login(client)
    company_b_headers = login(
        client,
        "empresa-b@gestoria.dev",
    )

    employee = create_employee(
        client,
        company_a_headers,
        document="33344455566",
    )
    employee_record = create_record(
        client,
        company_a_headers,
        employee["id"],
    )

    foreign_list = client.get(
        f"{EMPLOYEES_URL}/{employee['id']}/records",
        headers=company_b_headers,
    )
    assert foreign_list.status_code == 404

    foreign_detail = client.get(
        f"{RECORDS_URL}/{employee_record['id']}",
        headers=company_b_headers,
    )
    assert foreign_detail.status_code == 404

    foreign_update = client.patch(
        f"{RECORDS_URL}/{employee_record['id']}",
        headers=company_b_headers,
        json={"title": "Tentativa externa"},
    )
    assert foreign_update.status_code == 404

    foreign_resolve = client.post(
        f"{RECORDS_URL}/{employee_record['id']}/resolve",
        headers=company_b_headers,
        json={"resolution_notes": "Tentativa externa."},
    )
    assert foreign_resolve.status_code == 404

    foreign_cancel = client.post(
        f"{RECORDS_URL}/{employee_record['id']}/cancel",
        headers=company_b_headers,
        json={"cancellation_reason": "Tentativa externa."},
    )
    assert foreign_cancel.status_code == 404


def test_employee_record_api_validates_payload_and_filters(
    client: TestClient,
) -> None:
    owner_headers = login(client)
    employee = create_employee(
        client,
        owner_headers,
        document="44455566677",
    )
    records_url = f"{EMPLOYEES_URL}/{employee['id']}/records"

    invalid_type = client.post(
        records_url,
        headers=owner_headers,
        json={
            "record_type": "invalid",
            "severity": "medium",
            "title": "Tipo inválido",
            "description": "Descrição do tipo inválido.",
            "occurred_at": "2026-10-01T10:30:00-03:00",
        },
    )
    assert invalid_type.status_code == 422

    future_date = client.post(
        records_url,
        headers=owner_headers,
        json={
            "record_type": "warning",
            "severity": "medium",
            "title": "Data futura",
            "description": "Descrição com data futura.",
            "occurred_at": "2999-01-01T10:30:00-03:00",
        },
    )
    assert future_date.status_code == 422

    invalid_filter = client.get(
        f"{records_url}?status=invalid",
        headers=owner_headers,
    )
    assert invalid_filter.status_code == 422
