from fastapi.testclient import TestClient


def login(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": "lucas@gestoria.dev", "password": "SenhaForte@123"},
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
