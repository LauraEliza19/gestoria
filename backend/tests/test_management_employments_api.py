from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_api import login

from app.models import OrganizationMember, User

EMPLOYEES_URL = "/api/management/employees"
COST_CENTERS_URL = "/api/management/cost-centers"


def create_employee_record(
    client: TestClient,
    headers: dict[str, str],
) -> dict:
    response = client.post(
        EMPLOYEES_URL,
        headers=headers,
        json={
            "full_name": "Funcionário com Vínculo",
            "document": "12345678901",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_cost_center_record(
    client: TestClient,
    headers: dict[str, str],
) -> dict:
    response = client.post(
        COST_CENTERS_URL,
        headers=headers,
        json={
            "code": "TEC",
            "name": "Tecnologia",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_employment_api_flow_hides_and_protects_compensation(
    client: TestClient,
) -> None:
    owner_headers = login(client)
    employee = create_employee_record(client, owner_headers)
    cost_center = create_cost_center_record(client, owner_headers)

    employments_url = f"{EMPLOYEES_URL}/{employee['id']}/employments"

    created = client.post(
        employments_url,
        headers=owner_headers,
        json={
            "cost_center_id": cost_center["id"],
            "position_title": "Desenvolvedor",
            "employment_type": "employee",
            "status": "active",
            "started_at": "2026-01-10",
            "base_salary": "3500.00",
        },
    )
    assert created.status_code == 201

    employment = created.json()
    assert employment["employee_id"] == employee["id"]
    assert employment["cost_center_id"] == cost_center["id"]
    assert employment["status"] == "active"
    assert "base_salary" not in employment

    listed = client.get(
        employments_url,
        headers=owner_headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert "base_salary" not in listed.json()[0]

    compensation = client.get(
        (f"/api/management/employments/{employment['id']}/compensation"),
        headers=owner_headers,
    )
    assert compensation.status_code == 200
    assert compensation.json()["base_salary"] == "3500.00"

    ended = client.patch(
        f"/api/management/employments/{employment['id']}",
        headers=owner_headers,
        json={
            "status": "ended",
            "ended_at": "2026-09-30",
        },
    )
    assert ended.status_code == 200
    assert ended.json()["status"] == "ended"
    assert ended.json()["ended_at"] == "2026-09-30"


def test_employment_api_validates_current_link_and_cost_center(
    client: TestClient,
) -> None:
    owner_headers = login(client)
    company_b_headers = login(
        client,
        "empresa-b@gestoria.dev",
    )
    employee = create_employee_record(client, owner_headers)

    foreign_cost_center = client.post(
        COST_CENTERS_URL,
        headers=company_b_headers,
        json={
            "code": "EXT",
            "name": "Centro Externo",
        },
    )
    assert foreign_cost_center.status_code == 201

    employments_url = f"{EMPLOYEES_URL}/{employee['id']}/employments"

    foreign_reference = client.post(
        employments_url,
        headers=owner_headers,
        json={
            "cost_center_id": foreign_cost_center.json()["id"],
            "position_title": "Analista",
            "employment_type": "employee",
            "status": "active",
            "started_at": "2026-01-10",
        },
    )
    assert foreign_reference.status_code == 422

    first = client.post(
        employments_url,
        headers=owner_headers,
        json={
            "position_title": "Analista",
            "employment_type": "employee",
            "status": "active",
            "started_at": "2026-01-10",
        },
    )
    assert first.status_code == 201

    duplicate_current = client.post(
        employments_url,
        headers=owner_headers,
        json={
            "position_title": "Analista Sênior",
            "employment_type": "employee",
            "status": "on_leave",
            "started_at": "2026-02-01",
        },
    )
    assert duplicate_current.status_code == 409
    assert "já possui um vínculo ativo" in duplicate_current.json()["detail"]


def test_admin_can_manage_employment_but_cannot_access_salary(
    client: TestClient,
    db: Session,
) -> None:
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
    employee = create_employee_record(client, admin_headers)
    employments_url = f"{EMPLOYEES_URL}/{employee['id']}/employments"

    salary_attempt = client.post(
        employments_url,
        headers=admin_headers,
        json={
            "position_title": "Analista",
            "employment_type": "employee",
            "status": "active",
            "started_at": "2026-01-10",
            "base_salary": "3000.00",
        },
    )
    assert salary_attempt.status_code == 403

    created = client.post(
        employments_url,
        headers=admin_headers,
        json={
            "position_title": "Analista",
            "employment_type": "employee",
            "status": "active",
            "started_at": "2026-01-10",
        },
    )
    assert created.status_code == 201
    employment = created.json()

    compensation = client.get(
        (f"/api/management/employments/{employment['id']}/compensation"),
        headers=admin_headers,
    )
    assert compensation.status_code == 403

    salary_update = client.patch(
        f"/api/management/employments/{employment['id']}",
        headers=admin_headers,
        json={"base_salary": "3200.00"},
    )
    assert salary_update.status_code == 403


def test_employment_api_permissions_and_tenant_isolation(
    client: TestClient,
) -> None:
    owner_headers = login(client)
    member_headers = login(
        client,
        "membro@gestoria.dev",
    )
    company_b_headers = login(
        client,
        "empresa-b@gestoria.dev",
    )

    employee = create_employee_record(client, owner_headers)
    employments_url = f"{EMPLOYEES_URL}/{employee['id']}/employments"

    created = client.post(
        employments_url,
        headers=owner_headers,
        json={
            "position_title": "Analista",
            "employment_type": "employee",
            "status": "active",
            "started_at": "2026-01-10",
        },
    )
    assert created.status_code == 201
    employment = created.json()

    assert (
        client.get(
            employments_url,
            headers=member_headers,
        ).status_code
        == 403
    )

    foreign_list = client.get(
        employments_url,
        headers=company_b_headers,
    )
    assert foreign_list.status_code == 404

    foreign_update = client.patch(
        f"/api/management/employments/{employment['id']}",
        headers=company_b_headers,
        json={"position_title": "Tentativa externa"},
    )
    assert foreign_update.status_code == 404

    foreign_compensation = client.get(
        (f"/api/management/employments/{employment['id']}/compensation"),
        headers=company_b_headers,
    )
    assert foreign_compensation.status_code == 404
