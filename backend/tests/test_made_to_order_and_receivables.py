"""Venda sob encomenda, número do pedido e contas a receber geradas pelo pedido."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from order_helpers import secure_order
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_api import login, page_items

from app.models import (
    FinanceAuditEvent,
    FinanceCategory,
    FinanceEntry,
    Order,
    OrderItem,
    Organization,
    Product,
)
from app.models.finance import business_today
from app.services.finance_defaults import (
    DEFAULT_FINANCE_CATEGORIES,
    create_default_categories,
    ensure_sales_category,
)
from app.services.order_finance import add_months, split_amount
from app.services.orders import format_quantity

MEMBER = "membro@gestoria.dev"


def create_customer(client, headers, name="Maria Souza", phone="35999990001"):
    response = client.post(
        "/api/customers", headers=headers, json={"name": name, "phone": phone}
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_product(client, headers, **overrides):
    body = {
        "name": "Bolo de chocolate",
        "price": "120.00",
        "stock_quantity": "0",
        "product_type": "manufactured",
        "category": "confeitaria",
        "made_to_order": True,
        **overrides,
    }
    response = client.post("/api/products", headers=headers, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def place_order(client, headers, customer, product, quantity="3", **extra):
    return secure_order(
        client,
        headers=headers,
        json={
            "customer_id": customer["id"],
            "items": [{"product_id": product["id"], "quantity": quantity}],
            **extra,
        },
    )


def receivables(client, headers, **params):
    response = client.get(
        "/api/finance/entries",
        headers=headers,
        params={"sort": "due_date", **params},
    )
    assert response.status_code == 200, response.text
    return [item for item in response.json()["items"] if item["order_id"]]


def stock_of(client, headers, product_id):
    products = page_items(client.get("/api/products", headers=headers))
    return Decimal(next(p for p in products if p["id"] == product_id)["stock_quantity"])


def org_a(db: Session) -> Organization:
    return db.scalar(select(Organization).where(Organization.slug == "empresa-a"))


# ---------------------------------------------------------------------------
# Venda sob encomenda
# ---------------------------------------------------------------------------


def test_made_to_order_product_sells_without_finished_stock(client: TestClient):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers)

    assert product["made_to_order"] is True
    assert product["status"] == "Sob encomenda"
    assert product["category"] == "confeitaria"

    response = place_order(client, headers, customer, product)

    assert response.status_code == 201, response.text
    assert response.json()["total_amount"] == "360.00"
    # O estoque de produto pronto não é exigido nem fica negativo.
    assert stock_of(client, headers, product["id"]) == 0


def test_made_to_order_items_are_marked_and_cancel_returns_nothing(
    client: TestClient, db: Session
):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers, stock_quantity="2")
    order = place_order(client, headers, customer, product).json()

    item = db.scalar(
        select(OrderItem).where(OrderItem.order_id == uuid.UUID(order["id"]))
    )
    assert item.stock_deducted is False
    assert stock_of(client, headers, product["id"]) == 2

    cancelled = client.patch(
        f"/api/orders/{order['id']}", headers=headers, json={"status": "cancelled"}
    )
    assert cancelled.status_code == 200, cancelled.text
    # Nada saiu do estoque, então nada volta.
    assert stock_of(client, headers, product["id"]) == 2


def test_stocked_product_still_requires_stock_with_clear_message(client: TestClient):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(
        client, headers, name="Pão de mel", made_to_order=False, stock_quantity="0"
    )

    response = place_order(client, headers, customer, product, quantity="1.5")

    assert response.status_code == 409
    detail = response.json()["detail"]
    message = detail["message"] if isinstance(detail, dict) else detail
    assert "disponível 0, solicitado 1,5." in message
    assert "Vendido sob encomenda" in message


def test_resale_product_message_has_no_made_to_order_hint(client: TestClient):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(
        client,
        headers,
        name="Refrigerante",
        product_type="resale",
        category="bebidas",
        unit_of_measure="l",
        made_to_order=False,
    )

    response = place_order(client, headers, customer, product, quantity="2")

    assert response.status_code == 409
    detail = response.json()["detail"]
    message = detail["message"] if isinstance(detail, dict) else detail
    assert "disponível 0, solicitado 2." in message
    assert "encomenda" not in message


def test_cancel_and_reactivate_follow_the_current_product_rule(
    client: TestClient, db: Session
):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers, made_to_order=False, stock_quantity="5")
    order = place_order(client, headers, customer, product, quantity="2").json()
    assert stock_of(client, headers, product["id"]) == 3

    url = f"/api/orders/{order['id']}"
    assert (
        client.patch(url, headers=headers, json={"status": "cancelled"}).status_code
        == 200
    )
    assert stock_of(client, headers, product["id"]) == 5

    # O produto passou a ser sob encomenda: reativar não tira do estoque.
    client.patch(
        f"/api/products/{product['id']}", headers=headers, json={"made_to_order": True}
    )
    reopened = client.patch(url, headers=headers, json={"status": "in_preparation"})
    assert reopened.status_code == 200, reopened.text
    assert stock_of(client, headers, product["id"]) == 5
    item = db.scalar(
        select(OrderItem).where(OrderItem.order_id == uuid.UUID(order["id"]))
    )
    db.refresh(item)
    assert item.stock_deducted is False


def test_quote_with_made_to_order_product_converts_without_stock(client: TestClient):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers)
    quote = client.post(
        "/api/quotes",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "valid_until": (business_today() + timedelta(days=5)).isoformat(),
            "items": [{"product_id": product["id"], "quantity": 1}],
        },
    ).json()
    client.patch(
        f"/api/quotes/{quote['id']}", headers=headers, json={"status": "approved"}
    )

    converted = client.post(f"/api/quotes/{quote['id']}/convert", headers=headers)

    assert converted.status_code == 200, converted.text
    assert converted.json()["status"] == "converted"


def test_patch_with_null_made_to_order_keeps_the_current_value(client: TestClient):
    headers = login(client)
    product = create_product(client, headers)

    response = client.patch(
        f"/api/products/{product['id']}",
        headers=headers,
        json={"made_to_order": None, "name": "Bolo de cenoura"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["made_to_order"] is True


def test_dashboard_does_not_flag_made_to_order_products_as_critical(
    client: TestClient,
):
    headers = login(client)
    create_product(client, headers)

    overview = client.get("/api/dashboard/overview", headers=headers).json()

    assert overview["summary"]["critical_stock_items"] == 0


def test_quantity_format_is_brazilian_without_useless_zeros():
    assert format_quantity(Decimal("0.000")) == "0"
    assert format_quantity(Decimal("3.000")) == "3"
    assert format_quantity(Decimal("1.500")) == "1,5"
    assert format_quantity(Decimal("0.250")) == "0,25"


# ---------------------------------------------------------------------------
# Número do pedido
# ---------------------------------------------------------------------------


def test_orders_get_sequential_codes_per_company(client: TestClient):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers)

    first = place_order(client, headers, customer, product).json()
    second = place_order(client, headers, customer, product).json()

    assert first["code"] == "PED-000001"
    assert second["code"] == "PED-000002"

    found = page_items(
        client.get("/api/orders", headers=headers, params={"search": "PED-000002"})
    )
    assert [order["id"] for order in found] == [second["id"]]

    other_headers = login(client, "empresa-b@gestoria.dev")
    other_customer = page_items(client.get("/api/customers", headers=other_headers))[0]
    other_product = create_product(client, other_headers, name="Torta")
    other = place_order(client, other_headers, other_customer, other_product).json()
    assert other["code"] == "PED-000001"


# ---------------------------------------------------------------------------
# Contas a receber
# ---------------------------------------------------------------------------


def test_direct_order_creates_one_receivable_due_on_delivery(
    client: TestClient, db: Session
):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers)
    delivery = business_today() + timedelta(days=4)

    order = place_order(
        client,
        headers,
        customer,
        product,
        promised_at=f"{delivery.isoformat()}T23:30:00-03:00",
    ).json()

    entries = receivables(client, headers)
    assert len(entries) == 1
    entry = entries[0]
    assert entry["order_id"] == order["id"]
    assert entry["entry_type"] == "income"
    assert entry["status"] == "pending"
    assert entry["amount"] == "360.00"
    # 23h30 em Brasília já é o dia seguinte em UTC; o vencimento usa o dia local.
    assert entry["due_date"] == delivery.isoformat()
    assert entry["transaction_date"] == business_today().isoformat()
    assert entry["description"] == f"Pedido {order['code']} - Maria Souza"

    category = db.get(FinanceCategory, uuid.UUID(entry["category_id"]))
    assert category.name == "Vendas"
    events = {
        event.event_type
        for event in db.scalars(
            select(FinanceAuditEvent).where(
                FinanceAuditEvent.organization_id == org_a(db).id
            )
        )
    }
    assert {"category_created", "entry_created"} <= events

    # A receita só entra no resumo depois da baixa (recebimento).
    summary = client.get("/api/finance/summary", headers=headers).json()
    assert Decimal(summary["total_income"]) == 0
    settled = client.post(
        f"/api/finance/entries/{entry['id']}/settle",
        headers=headers,
        json={"expected_version": entry["version"]},
    )
    assert settled.status_code == 200, settled.text
    summary = client.get("/api/finance/summary", headers=headers).json()
    assert Decimal(summary["total_income"]) == Decimal("360.00")


def test_order_without_delivery_date_is_due_today(client: TestClient):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers)

    place_order(client, headers, customer, product)

    [entry] = receivables(client, headers)
    assert entry["due_date"] == business_today().isoformat()


def test_existing_sales_category_is_reused(client: TestClient, db: Session):
    headers = login(client)
    existing = client.post(
        "/api/finance/categories", headers=headers, json={"name": "vendas"}
    ).json()
    customer = create_customer(client, headers)
    product = create_product(client, headers)

    place_order(client, headers, customer, product)
    place_order(client, headers, customer, product)

    entries = receivables(client, headers)
    assert {entry["category_id"] for entry in entries} == {existing["id"]}
    names = db.scalars(
        select(FinanceCategory.name).where(
            FinanceCategory.organization_id == org_a(db).id
        )
    ).all()
    assert names == ["vendas"]


def test_member_without_finance_access_can_still_sell(client: TestClient, db: Session):
    owner = login(client)
    member = login(client, MEMBER)
    customer = create_customer(client, owner)
    product = create_product(client, owner)

    response = place_order(client, member, customer, product)

    assert response.status_code == 201, response.text
    assert client.get("/api/finance/entries", headers=member).status_code == 403
    assert len(receivables(client, owner)) == 1


def test_quote_conversion_takes_delivery_and_creates_installments(
    client: TestClient, db: Session
):
    headers = login(client)
    customer = create_customer(client, headers, name="Buffet Festa Boa")
    product = create_product(client, headers, price="100.00")
    quote = client.post(
        "/api/quotes",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "valid_until": (business_today() + timedelta(days=5)).isoformat(),
            "payment_terms": "installments",
            "installment_count": 3,
            "items": [{"product_id": product["id"], "quantity": 1}],
        },
    ).json()
    client.patch(
        f"/api/quotes/{quote['id']}", headers=headers, json={"status": "approved"}
    )
    delivery = business_today() + timedelta(days=2)

    converted = client.post(
        f"/api/quotes/{quote['id']}/convert",
        headers=headers,
        json={
            "promised_at": f"{delivery.isoformat()}T15:00:00-03:00",
            "priority": "high",
            "notes": "Entregar na portaria",
        },
    )

    assert converted.status_code == 200, converted.text
    order = db.get(Order, uuid.UUID(converted.json()["converted_order_id"]))
    assert order.promised_at is not None
    assert order.priority == "high"
    assert order.notes == "Entregar na portaria"
    assert order.code == "PED-000001"

    entries = receivables(client, headers)
    assert [entry["amount"] for entry in entries] == ["33.34", "33.33", "33.33"]
    assert [entry["due_date"] for entry in entries] == [
        delivery.isoformat(),
        add_months(delivery, 1).isoformat(),
        add_months(delivery, 2).isoformat(),
    ]
    assert entries[0]["description"].endswith("(parcela 1/3)")
    assert sum(Decimal(entry["amount"]) for entry in entries) == Decimal("100.00")


def test_quote_conversion_rejects_delivery_without_timezone(client: TestClient):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers)
    quote = client.post(
        "/api/quotes",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "valid_until": (business_today() + timedelta(days=5)).isoformat(),
            "items": [{"product_id": product["id"], "quantity": 1}],
        },
    ).json()
    client.patch(
        f"/api/quotes/{quote['id']}", headers=headers, json={"status": "approved"}
    )

    response = client.post(
        f"/api/quotes/{quote['id']}/convert",
        headers=headers,
        json={"promised_at": "2026-12-01T10:00:00"},
    )

    assert response.status_code == 422
    assert receivables(client, headers) == []


def test_cancel_reactivate_and_delete_keep_receivables_in_sync(
    client: TestClient, db: Session
):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers)
    order = place_order(client, headers, customer, product).json()
    url = f"/api/orders/{order['id']}"

    client.patch(url, headers=headers, json={"status": "cancelled"})
    [entry] = receivables(client, headers)
    assert entry["status"] == "cancelled"
    assert entry["version"] == 2

    client.patch(url, headers=headers, json={"status": "in_preparation"})
    [entry] = receivables(client, headers)
    assert entry["status"] == "pending"

    assert client.delete(url, headers=headers).status_code == 204
    stored = db.get(FinanceEntry, uuid.UUID(entry["id"]))
    db.refresh(stored)
    # O histórico fica no Financeiro, cancelado e sem apontar para o pedido.
    assert stored.order_id is None
    assert stored.status == "cancelled"


def test_cancelling_keeps_installments_already_received(client: TestClient):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers)
    order = place_order(client, headers, customer, product).json()
    [entry] = receivables(client, headers)
    client.post(
        f"/api/finance/entries/{entry['id']}/settle",
        headers=headers,
        json={"expected_version": entry["version"]},
    )

    client.patch(
        f"/api/orders/{order['id']}", headers=headers, json={"status": "cancelled"}
    )

    [entry] = receivables(client, headers)
    assert entry["status"] == "paid"


def test_failed_order_leaves_no_receivable_or_category(client: TestClient, db: Session):
    headers = login(client)
    customer = create_customer(client, headers)
    product = create_product(client, headers, made_to_order=False)

    assert place_order(client, headers, customer, product).status_code == 409

    assert db.scalar(select(FinanceEntry.id).limit(1)) is None
    assert db.scalar(select(FinanceCategory.id).limit(1)) is None


def test_split_amount_and_add_months():
    assert split_amount(Decimal("100.00"), 3) == [
        Decimal("33.34"),
        Decimal("33.33"),
        Decimal("33.33"),
    ]
    assert split_amount(Decimal("10.00"), 1) == [Decimal("10.00")]
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2026, 11, 30), 3) == date(2027, 2, 28)
    assert add_months(date(2026, 12, 15), 1) == date(2027, 1, 15)


# ---------------------------------------------------------------------------
# Categorias padrão
# ---------------------------------------------------------------------------


def test_default_categories_are_created_only_for_empty_companies(db: Session):
    organization = org_a(db)

    assert create_default_categories(db, organization.id) == len(
        DEFAULT_FINANCE_CATEGORIES
    )
    assert create_default_categories(db, organization.id) == 0
    db.commit()

    names = set(
        db.scalars(
            select(FinanceCategory.name).where(
                FinanceCategory.organization_id == organization.id
            )
        )
    )
    assert names == {name for name, _ in DEFAULT_FINANCE_CATEGORIES}
    category, created = ensure_sales_category(db, organization.id)
    assert category.name == "Vendas" and created is None


def test_made_to_order_model_status_and_defaults():
    product = Product(
        organization_id=uuid.uuid4(),
        code="PRO-1",
        name="Bolo",
        price=Decimal(10),
        stock_quantity=0,
        is_active=True,
        made_to_order=True,
    )
    assert product.status == "Sob encomenda"
    product.is_active = False
    assert product.status == "Inativo"
