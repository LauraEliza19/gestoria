from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.repositories import OrderRepository
from app.services.quotes import business_today


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
    assert client.get("/static/css/app.css").status_code == 200
    assert client.get("/static/js/controllers/login.controller.js").status_code == 200
    assert client.get("/assets/backend/app/config.py").status_code == 404
    assert client.get("/static/backend/app/config.py").status_code == 404


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
    assert Decimal(order["items"][0]["quantity"]) == Decimal("3")

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal("2")

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
    assert Decimal(
        client.get("/api/products", headers=headers).json()[0]["stock_quantity"]
    ) == Decimal("5")
    assert Decimal(
        client.get("/api/customers", headers=headers).json()[0]["total_spent"]
    ) == Decimal(0)

    reactivated = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "in_preparation"},
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["status"] == "in_preparation"
    assert Decimal(
        client.get("/api/products", headers=headers).json()[0]["stock_quantity"]
    ) == Decimal("2")

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
    assert Decimal(
        client.get("/api/products", headers=headers).json()[0]["stock_quantity"]
    ) == Decimal("5")
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
    assert Decimal(
        client.get("/api/products", headers=headers).json()[0]["stock_quantity"]
    ) == Decimal("1")


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


def test_quote_api_flow_converts_only_once(client: TestClient) -> None:
    headers = login(client)

    customer_response = client.post(
        "/api/customers",
        headers=headers,
        json={
            "name": "Cliente Orçamento API",
            "phone": "35922221111",
        },
    )
    assert customer_response.status_code == 201
    customer = customer_response.json()

    product_response = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": "Produto Orçamento API",
            "price": "10.00",
            "stock_quantity": 5,
        },
    )
    assert product_response.status_code == 201
    product = product_response.json()

    created_response = client.post(
        "/api/quotes",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "valid_until": (business_today() + timedelta(days=7)).isoformat(),
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": 2,
                }
            ],
        },
    )
    assert created_response.status_code == 201

    quote = created_response.json()
    assert quote["status"] == "pending"
    assert quote["total_amount"] == "20.00"
    assert quote["converted_order_id"] is None
    assert len(quote["items"]) == 1
    assert quote["items"][0]["unit_price"] == "10.00"

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(5)

    price_change_response = client.patch(
        f"/api/products/{product['id']}",
        headers=headers,
        json={"price": "25.00"},
    )
    assert price_change_response.status_code == 200
    assert price_change_response.json()["price"] == "25.00"

    approved_response = client.patch(
        f"/api/quotes/{quote['id']}",
        headers=headers,
        json={"status": "approved"},
    )
    assert approved_response.status_code == 200
    assert approved_response.json()["status"] == "approved"

    converted_response = client.post(
        f"/api/quotes/{quote['id']}/convert",
        headers=headers,
    )
    assert converted_response.status_code == 200

    converted_quote = converted_response.json()
    assert converted_quote["status"] == "converted"
    assert converted_quote["converted_order_id"] is not None

    reopening = client.patch(
        f"/api/quotes/{quote['id']}",
        headers=headers,
        json={"status": "approved"},
    )
    assert reopening.status_code == 409
    assert "convertido" in reopening.json()["detail"]

    second_conversion = client.post(
        f"/api/quotes/{quote['id']}/convert",
        headers=headers,
    )
    assert second_conversion.status_code == 409
    assert "status atual: 'converted'" in second_conversion.json()["detail"]

    orders = client.get("/api/orders", headers=headers).json()
    assert len(orders) == 1
    assert orders[0]["id"] == converted_quote["converted_order_id"]
    assert orders[0]["total_amount"] == "20.00"
    assert len(orders[0]["items"]) == 1
    assert orders[0]["items"][0]["unit_price"] == "10.00"

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(3)


def test_expired_quote_cannot_be_approved_or_converted(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = login(client)
    today = business_today()

    customer = client.post(
        "/api/customers",
        headers=headers,
        json={
            "name": "Cliente Orçamento Vencido",
            "phone": "35911112222",
        },
    ).json()

    product = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": "Produto Orçamento Vencido",
            "price": "15.00",
            "stock_quantity": 5,
        },
    ).json()

    expired_quote = client.post(
        "/api/quotes",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "valid_until": (today - timedelta(days=1)).isoformat(),
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": 2,
                }
            ],
        },
    ).json()

    approval = client.patch(
        f"/api/quotes/{expired_quote['id']}",
        headers=headers,
        json={"status": "approved"},
    )
    assert approval.status_code == 409
    assert "vencido" in approval.json()["detail"]

    valid_quote = client.post(
        "/api/quotes",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "valid_until": (today + timedelta(days=1)).isoformat(),
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": 2,
                }
            ],
        },
    ).json()

    approval = client.patch(
        f"/api/quotes/{valid_quote['id']}",
        headers=headers,
        json={"status": "approved"},
    )
    assert approval.status_code == 200

    monkeypatch.setattr(
        "app.services.quotes.business_today",
        lambda: today + timedelta(days=2),
    )

    conversion = client.post(
        f"/api/quotes/{valid_quote['id']}/convert",
        headers=headers,
    )
    assert conversion.status_code == 409
    assert "vencido" in conversion.json()["detail"]

    assert client.get("/api/orders", headers=headers).json() == []

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(5)


def test_quote_api_is_isolated_between_organizations(
    client: TestClient,
) -> None:
    company_a_headers = login(client)
    company_b_headers = login(client, "empresa-b@gestoria.dev")

    company_b_customer = client.get(
        "/api/customers",
        headers=company_b_headers,
    ).json()[0]

    company_b_product = client.get(
        "/api/products",
        headers=company_b_headers,
    ).json()[0]

    created_response = client.post(
        "/api/quotes",
        headers=company_b_headers,
        json={
            "customer_id": company_b_customer["id"],
            "valid_until": (business_today() + timedelta(days=7)).isoformat(),
            "items": [
                {
                    "product_id": company_b_product["id"],
                    "quantity": 1,
                }
            ],
        },
    )
    assert created_response.status_code == 201
    company_b_quote = created_response.json()

    approved_response = client.patch(
        f"/api/quotes/{company_b_quote['id']}",
        headers=company_b_headers,
        json={"status": "approved"},
    )
    assert approved_response.status_code == 200

    assert (
        client.get(
            "/api/quotes",
            headers=company_a_headers,
        ).json()
        == []
    )

    unauthorized_update = client.patch(
        f"/api/quotes/{company_b_quote['id']}",
        headers=company_a_headers,
        json={"status": "rejected"},
    )
    assert unauthorized_update.status_code == 404

    unauthorized_conversion = client.post(
        f"/api/quotes/{company_b_quote['id']}/convert",
        headers=company_a_headers,
    )
    assert unauthorized_conversion.status_code == 404

    unauthorized_deletion = client.delete(
        f"/api/quotes/{company_b_quote['id']}",
        headers=company_a_headers,
    )
    assert unauthorized_deletion.status_code == 404

    company_b_quotes = client.get(
        "/api/quotes",
        headers=company_b_headers,
    ).json()
    assert len(company_b_quotes) == 1
    assert company_b_quotes[0]["id"] == company_b_quote["id"]
    assert company_b_quotes[0]["status"] == "approved"

    assert (
        client.get(
            "/api/orders",
            headers=company_b_headers,
        ).json()
        == []
    )


def test_only_owner_or_admin_can_delete_quote(
    client: TestClient,
) -> None:
    owner_headers = login(client)
    member_headers = login(client, "membro@gestoria.dev")

    customer = client.post(
        "/api/customers",
        headers=owner_headers,
        json={
            "name": "Cliente Permissão Orçamento",
            "phone": "35900001111",
        },
    ).json()

    product = client.post(
        "/api/products",
        headers=owner_headers,
        json={
            "name": "Produto Permissão Orçamento",
            "price": "8.00",
            "stock_quantity": 4,
        },
    ).json()

    quote_response = client.post(
        "/api/quotes",
        headers=owner_headers,
        json={
            "customer_id": customer["id"],
            "valid_until": (business_today() + timedelta(days=7)).isoformat(),
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": 1,
                }
            ],
        },
    )
    assert quote_response.status_code == 201
    quote = quote_response.json()

    forbidden = client.delete(
        f"/api/quotes/{quote['id']}",
        headers=member_headers,
    )
    assert forbidden.status_code == 403

    quotes_after_forbidden_attempt = client.get(
        "/api/quotes",
        headers=owner_headers,
    ).json()
    assert len(quotes_after_forbidden_attempt) == 1
    assert quotes_after_forbidden_attempt[0]["id"] == quote["id"]

    deleted = client.delete(
        f"/api/quotes/{quote['id']}",
        headers=owner_headers,
    )
    assert deleted.status_code == 204

    assert (
        client.get(
            "/api/quotes",
            headers=owner_headers,
        ).json()
        == []
    )


def test_quote_conversion_with_insufficient_stock_returns_conflict(
    client: TestClient,
) -> None:
    headers = login(client)

    customer = client.post(
        "/api/customers",
        headers=headers,
        json={
            "name": "Cliente Orçamento sem Estoque",
            "phone": "35900002222",
        },
    ).json()

    product = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": "Produto Orçado sem Estoque",
            "price": "12.00",
            "stock_quantity": 1,
        },
    ).json()

    quote_response = client.post(
        "/api/quotes",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "valid_until": (business_today() + timedelta(days=7)).isoformat(),
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": 2,
                }
            ],
        },
    )
    assert quote_response.status_code == 201
    quote = quote_response.json()

    approved_response = client.patch(
        f"/api/quotes/{quote['id']}",
        headers=headers,
        json={"status": "approved"},
    )
    assert approved_response.status_code == 200

    conversion = client.post(
        f"/api/quotes/{quote['id']}/convert",
        headers=headers,
    )
    assert conversion.status_code == 409
    assert "Estoque insuficiente" in conversion.json()["detail"]

    assert client.get("/api/orders", headers=headers).json() == []

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(1)

    quotes = client.get("/api/quotes", headers=headers).json()
    assert len(quotes) == 1
    assert quotes[0]["status"] == "approved"
    assert quotes[0]["converted_order_id"] is None

def test_cancelling_order_twice_restores_stock_only_once(
    client: TestClient,
) -> None:
    headers = login(client)

    customer = client.post(
        "/api/customers",
        headers=headers,
        json={
            "name": "Cliente Cancelamento Único",
            "phone": "35933334444",
        },
    ).json()

    product = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": "Produto Cancelamento Único",
            "price": "10.00",
            "stock_quantity": 5,
        },
    ).json()

    order_response = client.post(
        "/api/orders",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": 2,
                }
            ],
        },
    )
    assert order_response.status_code == 201
    order = order_response.json()

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(3)

    first_cancellation = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert first_cancellation.status_code == 200
    assert first_cancellation.json()["status"] == "cancelled"

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(5)

    second_cancellation = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert second_cancellation.status_code == 200
    assert second_cancellation.json()["status"] == "cancelled"

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(5)

    orders = client.get("/api/orders", headers=headers).json()
    assert len(orders) == 1
    assert orders[0]["status"] == "cancelled"

def test_deleting_order_twice_restores_stock_only_once(
    client: TestClient,
) -> None:
    headers = login(client)

    customer = client.post(
        "/api/customers",
        headers=headers,
        json={
            "name": "Cliente Exclusão Única",
            "phone": "35944445555",
        },
    ).json()

    product = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": "Produto Exclusão Única",
            "price": "10.00",
            "stock_quantity": 5,
        },
    ).json()

    order_response = client.post(
        "/api/orders",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": 2,
                }
            ],
        },
    )
    assert order_response.status_code == 201
    order = order_response.json()

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(3)

    first_deletion = client.delete(
        f"/api/orders/{order['id']}",
        headers=headers,
    )
    assert first_deletion.status_code == 204

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(5)

    second_deletion = client.delete(
        f"/api/orders/{order['id']}",
        headers=headers,
    )
    assert second_deletion.status_code == 404

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(5)

    assert client.get("/api/orders", headers=headers).json() == []

def test_order_update_and_delete_request_row_lock(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = login(client)

    customer = client.post(
        "/api/customers",
        headers=headers,
        json={
            "name": "Cliente Bloqueio Pedido",
            "phone": "35977778888",
        },
    ).json()

    product = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": "Produto Bloqueio Pedido",
            "price": "10.00",
            "stock_quantity": 5,
        },
    ).json()

    order = client.post(
        "/api/orders",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": 1,
                }
            ],
        },
    ).json()

    original_get = OrderRepository.get_for_organization
    requested_locks: list[bool] = []

    def track_lock_request(
        db,
        order_id,
        organization_id,
        *,
        for_update: bool = False,
    ):
        requested_locks.append(for_update)
        return original_get(
            db,
            order_id,
            organization_id,
            for_update=for_update,
        )

    monkeypatch.setattr(
        OrderRepository,
        "get_for_organization",
        staticmethod(track_lock_request),
    )

    cancellation = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert cancellation.status_code == 200
    assert requested_locks == [True]

    requested_locks.clear()

    deletion = client.delete(
        f"/api/orders/{order['id']}",
        headers=headers,
    )
    assert deletion.status_code == 204
    assert requested_locks == [True]

def test_order_api_rejects_invalid_status_transitions(
    client: TestClient,
) -> None:
    headers = login(client)

    customer = client.post(
        "/api/customers",
        headers=headers,
        json={
            "name": "Cliente Transição Pedido",
            "phone": "35988889999",
        },
    ).json()

    product = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": "Produto Transição Pedido",
            "price": "10.00",
            "stock_quantity": 5,
        },
    ).json()

    order = client.post(
        "/api/orders",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": 2,
                }
            ],
        },
    ).json()

    completed = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "completed"},
    )
    assert completed.status_code == 200

    completed_to_preparation = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "in_preparation"},
    )
    assert completed_to_preparation.status_code == 409

    cancelled = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert cancelled.status_code == 200

    cancelled_to_completed = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "completed"},
    )
    assert cancelled_to_completed.status_code == 409

    reactivated = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json={"status": "in_preparation"},
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["status"] == "in_preparation"

    products = client.get("/api/products", headers=headers).json()
    assert Decimal(products[0]["stock_quantity"]) == Decimal(3)