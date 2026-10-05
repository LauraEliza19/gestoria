from fastapi.testclient import TestClient
from test_api import login

COST_CENTERS_URL = "/api/management/cost-centers"
EMPLOYEES_URL = "/api/management/employees"


def test_cost_center_api_requires_authentication(
    client: TestClient,
) -> None:
    response = client.get(COST_CENTERS_URL)

    assert response.status_code == 401


def test_cost_center_api_flow_and_permissions(
    client: TestClient,
) -> None:
    owner_headers = login(client)
    member_headers = login(client, "membro@gestoria.dev")

    initial = client.get(
        COST_CENTERS_URL,
        headers=owner_headers,
    )
    assert initial.status_code == 200
    assert initial.json() == []

    created = client.post(
        COST_CENTERS_URL,
        headers=owner_headers,
        json={
            "code": " adm ",
            "name": " Administrativo ",
            "description": "Despesas administrativas",
        },
    )
    assert created.status_code == 201

    cost_center = created.json()
    assert cost_center["code"] == "ADM"
    assert cost_center["name"] == "Administrativo"
    assert cost_center["is_active"] is True

    duplicate = client.post(
        COST_CENTERS_URL,
        headers=owner_headers,
        json={
            "code": "ADM",
            "name": "Outro departamento",
        },
    )
    assert duplicate.status_code == 409
    assert "Já existe um centro de custo" in duplicate.json()["detail"]

    member_list = client.get(
        COST_CENTERS_URL,
        headers=member_headers,
    )
    assert member_list.status_code == 403
    assert (
        member_list.json()["detail"]
        == "Você não possui permissão para executar essa ação."
    )

    member_create = client.post(
        COST_CENTERS_URL,
        headers=member_headers,
        json={
            "code": "COM",
            "name": "Comercial",
        },
    )
    assert member_create.status_code == 403

    member_update = client.patch(
        f"{COST_CENTERS_URL}/{cost_center['id']}",
        headers=member_headers,
        json={"is_active": False},
    )
    assert member_update.status_code == 403

    updated = client.patch(
        f"{COST_CENTERS_URL}/{cost_center['id']}",
        headers=owner_headers,
        json={
            "name": "Administração",
            "is_active": False,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Administração"
    assert updated.json()["is_active"] is False

    active_items = client.get(
        f"{COST_CENTERS_URL}?active_only=true",
        headers=owner_headers,
    )
    assert active_items.status_code == 200
    assert active_items.json() == []


def test_cost_centers_are_isolated_between_companies(
    client: TestClient,
) -> None:
    company_a_headers = login(client)
    company_b_headers = login(
        client,
        "empresa-b@gestoria.dev",
    )

    created = client.post(
        COST_CENTERS_URL,
        headers=company_a_headers,
        json={
            "code": "TEC",
            "name": "Tecnologia",
        },
    )
    assert created.status_code == 201
    cost_center = created.json()

    company_b_items = client.get(
        COST_CENTERS_URL,
        headers=company_b_headers,
    )
    assert company_b_items.status_code == 200
    assert company_b_items.json() == []

    foreign_update = client.patch(
        f"{COST_CENTERS_URL}/{cost_center['id']}",
        headers=company_b_headers,
        json={"name": "Tentativa externa"},
    )
    assert foreign_update.status_code == 404


def test_employee_api_flow_and_summary_privacy(
    client: TestClient,
) -> None:
    owner_headers = login(client)

    current_user = client.get(
        "/api/auth/me",
        headers=owner_headers,
    )
    assert current_user.status_code == 200
    user_id = current_user.json()["id"]

    created = client.post(
        EMPLOYEES_URL,
        headers=owner_headers,
        json={
            "user_id": user_id,
            "full_name": " Maria da Silva ",
            "document": "123.456.789-01",
            "email": "MARIA@EXAMPLE.COM",
            "phone": "(35) 99999-0000",
            "birth_date": "1995-05-20",
        },
    )
    assert created.status_code == 201

    employee = created.json()
    assert employee["full_name"] == "Maria da Silva"
    assert employee["document"] == "12345678901"
    assert employee["email"] == "maria@example.com"
    assert employee["phone"] == "35999990000"
    assert employee["user_id"] == user_id

    listed = client.get(
        EMPLOYEES_URL,
        headers=owner_headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    summary = listed.json()[0]
    assert summary["id"] == employee["id"]
    assert summary["full_name"] == "Maria da Silva"
    assert "document" not in summary
    assert "birth_date" not in summary
    assert "user_id" not in summary

    detail = client.get(
        f"{EMPLOYEES_URL}/{employee['id']}",
        headers=owner_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["document"] == "12345678901"
    assert detail.json()["birth_date"] == "1995-05-20"

    updated = client.patch(
        f"{EMPLOYEES_URL}/{employee['id']}",
        headers=owner_headers,
        json={
            "full_name": "Maria Silva",
            "is_active": False,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Maria Silva"
    assert updated.json()["is_active"] is False

    active_items = client.get(
        f"{EMPLOYEES_URL}?active_only=true",
        headers=owner_headers,
    )
    assert active_items.status_code == 200
    assert active_items.json() == []


def test_employee_api_rejects_duplicates_and_foreign_user(
    client: TestClient,
) -> None:
    owner_headers = login(client)
    company_b_headers = login(
        client,
        "empresa-b@gestoria.dev",
    )

    foreign_user = client.get(
        "/api/auth/me",
        headers=company_b_headers,
    )
    assert foreign_user.status_code == 200

    foreign_link = client.post(
        EMPLOYEES_URL,
        headers=owner_headers,
        json={
            "user_id": foreign_user.json()["id"],
            "full_name": "Usuário Externo",
            "document": "22233344455",
        },
    )
    assert foreign_link.status_code == 422
    assert "não pertence ou não está ativo" in foreign_link.json()["detail"]

    first = client.post(
        EMPLOYEES_URL,
        headers=owner_headers,
        json={
            "full_name": "Primeiro Funcionário",
            "document": "33344455566",
        },
    )
    assert first.status_code == 201

    duplicate = client.post(
        EMPLOYEES_URL,
        headers=owner_headers,
        json={
            "full_name": "Funcionário Duplicado",
            "document": "333.444.555-66",
        },
    )
    assert duplicate.status_code == 409
    assert "Já existe um funcionário" in duplicate.json()["detail"]


def test_employee_api_permissions_and_tenant_isolation(
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

    created = client.post(
        EMPLOYEES_URL,
        headers=owner_headers,
        json={
            "full_name": "Funcionário Empresa A",
            "document": "44455566677",
        },
    )
    assert created.status_code == 201
    employee = created.json()

    assert (
        client.get(
            EMPLOYEES_URL,
            headers=member_headers,
        ).status_code
        == 403
    )
    assert (
        client.post(
            EMPLOYEES_URL,
            headers=member_headers,
            json={"full_name": "Sem Permissão"},
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"{EMPLOYEES_URL}/{employee['id']}",
            headers=member_headers,
        ).status_code
        == 403
    )

    company_b_list = client.get(
        EMPLOYEES_URL,
        headers=company_b_headers,
    )
    assert company_b_list.status_code == 200
    assert company_b_list.json() == []

    foreign_detail = client.get(
        f"{EMPLOYEES_URL}/{employee['id']}",
        headers=company_b_headers,
    )
    assert foreign_detail.status_code == 404

    foreign_update = client.patch(
        f"{EMPLOYEES_URL}/{employee['id']}",
        headers=company_b_headers,
        json={"full_name": "Tentativa externa"},
    )
    assert foreign_update.status_code == 404
