from decimal import Decimal

from fastapi.testclient import TestClient


def login(
    client: TestClient,
    email: str = "lucas@gestoria.dev",
    password: str = "SenhaForte@123",
) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_health_and_frontend_are_available(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}
    assert "GestorIA" in client.get("/").text
    assert "Catálogo de produtos" in client.get("/dashboard").text
    assert client.get("/assets/loginStyle.css").status_code == 200
    assert client.get("/assets/backend/app/config.py").status_code == 404


def test_login_rejects_invalid_password(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "lucas@gestoria.dev", "password": "senha-errada"},
    )
    assert response.status_code == 401
    assert client.get("/api/products").status_code == 401


def test_authenticated_product_flow_is_tenant_scoped(client: TestClient) -> None:
    headers = login(client)

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["organization"]["slug"] == "empresa-a"

    initial_products = client.get("/api/products", headers=headers)
    assert initial_products.status_code == 200
    assert initial_products.json() == []

    created = client.post(
        "/api/products",
        headers=headers,
        json={"name": "Café especial", "price": "27.50", "stock_quantity": 3},
    )
    assert created.status_code == 201
    product = created.json()
    assert product["status"] == "Estoque baixo"

    listed = client.get("/api/products", headers=headers).json()
    assert [item["name"] for item in listed] == ["Café especial"]
    assert "Produto privado da Empresa B" not in [item["name"] for item in listed]

    updated = client.patch(
        f"/api/products/{product['id']}",
        headers=headers,
        json={"stock_quantity": 12},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "Disponível"

    deleted = client.delete(f"/api/products/{product['id']}", headers=headers)
    assert deleted.status_code == 204
    assert client.get("/api/products", headers=headers).json() == []


def test_duplicate_product_name_returns_conflict(client: TestClient) -> None:
    headers = login(client)
    payload = {"name": "Bolo", "price": "30.00", "stock_quantity": 2}

    assert (
        client.post("/api/products", headers=headers, json=payload).status_code == 201
    )
    duplicate = client.post("/api/products", headers=headers, json=payload)

    assert duplicate.status_code == 409

    blank_name = client.post(
        "/api/products",
        headers=headers,
        json={"name": "   ", "price": "1.00", "stock_quantity": 0},
    )
    assert blank_name.status_code == 422


def test_customer_flow_normalizes_phone_and_checks_permissions(
    client: TestClient,
) -> None:
    owner_headers = login(client)
    member_headers = login(client, "membro@gestoria.dev")

    created = client.post(
        "/api/customers",
        headers=owner_headers,
        json={"name": "Maria Souza", "phone": "(35) 99999-0000"},
    )
    assert created.status_code == 201
    customer = created.json()
    assert customer["phone"] == "35999990000"
    assert Decimal(customer["total_spent"]) == Decimal(0)
    assert customer["orders_count"] == 0

    duplicate = client.post(
        "/api/customers",
        headers=owner_headers,
        json={"name": "Outra Maria", "phone": "35 99999 0000"},
    )
    assert duplicate.status_code == 409

    updated = client.patch(
        f"/api/customers/{customer['id']}",
        headers=owner_headers,
        json={"name": "Maria Silva"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Maria Silva"

    forbidden = client.delete(
        f"/api/customers/{customer['id']}", headers=member_headers
    )
    assert forbidden.status_code == 403
    assert (
        client.delete(
            f"/api/customers/{customer['id']}", headers=owner_headers
        ).status_code
        == 204
    )


def test_order_flow_updates_stock_status_and_customer_total(
    client: TestClient,
) -> None:
    headers = login(client)
    customer = client.post(
        "/api/customers",
        headers=headers,
        json={"name": "Cliente Pedido", "phone": "35988887777"},
    ).json()
    product = client.post(
        "/api/products",
        headers=headers,
        json={"name": "Café", "price": "12.50", "stock_quantity": 5},
    ).json()

    created = client.post(
        "/api/orders",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "items": [
                {"product_id": product["id"], "quantity": 2},
                {"product_id": product["id"], "quantity": 1},
            ],
        },
    )
    assert created.status_code == 201
    order = created.json()
    assert order["total_amount"] == "37.50"
    assert len(order["items"]) == 1
    assert order["items"][0]["quantity"] == 3

    products = client.get("/api/products", headers=headers).json()
    assert products[0]["stock_quantity"] == 2

    completed = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "completed"},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"

    customers = client.get("/api/customers", headers=headers).json()
    assert customers[0]["total_spent"] == "37.50"
    assert customers[0]["orders_count"] == 1

    listed = client.get("/api/orders", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["customer_name"] == "Cliente Pedido"

    cancelled = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert cancelled.status_code == 200
    assert client.get("/api/products", headers=headers).json()[0]["stock_quantity"] == 5
    assert Decimal(
        client.get("/api/customers", headers=headers).json()[0]["total_spent"]
    ) == Decimal(0)

    reactivated = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "completed"},
    )
    assert reactivated.status_code == 200
    assert client.get("/api/products", headers=headers).json()[0]["stock_quantity"] == 2

    assert (
        client.delete(f"/api/customers/{customer['id']}", headers=headers).status_code
        == 409
    )
    assert (
        client.delete(f"/api/products/{product['id']}", headers=headers).status_code
        == 409
    )

    assert (
        client.delete(f"/api/orders/{order['id']}", headers=headers).status_code == 204
    )
    assert client.get("/api/products", headers=headers).json()[0]["stock_quantity"] == 5
    assert (
        client.delete(f"/api/customers/{customer['id']}", headers=headers).status_code
        == 204
    )
    assert (
        client.delete(f"/api/products/{product['id']}", headers=headers).status_code
        == 204
    )


def test_order_with_insufficient_stock_rolls_back_everything(
    client: TestClient,
) -> None:
    headers = login(client)
    customer = client.post(
        "/api/customers",
        headers=headers,
        json={"name": "Cliente sem estoque", "phone": "35977776666"},
    ).json()
    product = client.post(
        "/api/products",
        headers=headers,
        json={"name": "Última unidade", "price": "9.90", "stock_quantity": 1},
    ).json()

    response = client.post(
        "/api/orders",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "items": [{"product_id": product["id"], "quantity": 2}],
        },
    )
    assert response.status_code == 409
    assert client.get("/api/orders", headers=headers).json() == []
    assert client.get("/api/products", headers=headers).json()[0]["stock_quantity"] == 1


def test_customer_and_product_are_isolated_between_organizations(
    client: TestClient,
) -> None:
    company_a_headers = login(client)
    company_b_headers = login(client, "empresa-b@gestoria.dev")

    company_b_customer = client.get("/api/customers", headers=company_b_headers).json()[
        0
    ]
    company_b_product = client.get("/api/products", headers=company_b_headers).json()[0]

    assert client.get("/api/customers", headers=company_a_headers).json() == []
    assert (
        client.patch(
            f"/api/customers/{company_b_customer['id']}",
            headers=company_a_headers,
            json={"name": "Tentativa indevida"},
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/products/{company_b_product['id']}",
            headers=company_a_headers,
            json={"name": "Tentativa indevida"},
        ).status_code
        == 404
    )
