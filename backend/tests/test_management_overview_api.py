from fastapi.testclient import TestClient
from test_api import login

OVERVIEW_URL = "/api/management/overview"
EMPLOYEES_URL = "/api/management/employees"
COST_CENTERS_URL = "/api/management/cost-centers"


def create_employee(
    client: TestClient,
    headers: dict[str, str],
    *,
    name: str,
    document: str,
) -> dict:
    response = client.post(
        EMPLOYEES_URL,
        headers=headers,
        json={
            "full_name": name,
            "document": document,
        },
    )
    assert response.status_code == 201
    return response.json()


def create_cost_center(
    client: TestClient,
    headers: dict[str, str],
    *,
    code: str,
    name: str,
) -> dict:
    response = client.post(
        COST_CENTERS_URL,
        headers=headers,
        json={
            "code": code,
            "name": name,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_management_overview_permissions_and_empty_state(
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

    owner_overview = client.get(
        OVERVIEW_URL,
        headers=owner_headers,
    )
    assert owner_overview.status_code == 200
    assert owner_overview.json() == {
        "total_employees": 0,
        "active_employees": 0,
        "active_cost_centers": 0,
        "active_employments": 0,
        "employees_on_leave": 0,
    }

    member_overview = client.get(
        OVERVIEW_URL,
        headers=member_headers,
    )
    assert member_overview.status_code == 403

    company_b_overview = client.get(
        OVERVIEW_URL,
        headers=company_b_headers,
    )
    assert company_b_overview.status_code == 200
    assert company_b_overview.json()["total_employees"] == 0


def test_management_overview_counts_company_records(
    client: TestClient,
) -> None:
    owner_headers = login(client)

    active_employee = create_employee(
        client,
        owner_headers,
        name="Funcionário Ativo",
        document="11122233344",
    )
    inactive_employee = create_employee(
        client,
        owner_headers,
        name="Funcionário Inativo",
        document="55566677788",
    )

    active_cost_center = create_cost_center(
        client,
        owner_headers,
        code="TEC",
        name="Tecnologia",
    )
    inactive_cost_center = create_cost_center(
        client,
        owner_headers,
        code="ADM",
        name="Administrativo",
    )

    active_employment = client.post(
        (f"{EMPLOYEES_URL}/{active_employee['id']}/employments"),
        headers=owner_headers,
        json={
            "cost_center_id": active_cost_center["id"],
            "position_title": "Desenvolvedor",
            "employment_type": "employee",
            "status": "active",
            "started_at": "2026-01-10",
        },
    )
    assert active_employment.status_code == 201

    leave_employment = client.post(
        (f"{EMPLOYEES_URL}/{inactive_employee['id']}/employments"),
        headers=owner_headers,
        json={
            "cost_center_id": inactive_cost_center["id"],
            "position_title": "Analista",
            "employment_type": "employee",
            "status": "on_leave",
            "started_at": "2026-02-01",
        },
    )
    assert leave_employment.status_code == 201

    employee_update = client.patch(
        f"{EMPLOYEES_URL}/{inactive_employee['id']}",
        headers=owner_headers,
        json={"is_active": False},
    )
    assert employee_update.status_code == 200

    cost_center_update = client.patch(
        f"{COST_CENTERS_URL}/{inactive_cost_center['id']}",
        headers=owner_headers,
        json={"is_active": False},
    )
    assert cost_center_update.status_code == 200

    overview = client.get(
        OVERVIEW_URL,
        headers=owner_headers,
    )
    assert overview.status_code == 200
    assert overview.json() == {
        "total_employees": 2,
        "active_employees": 1,
        "active_cost_centers": 1,
        "active_employments": 1,
        "employees_on_leave": 1,
    }
