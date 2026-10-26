from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_api import login

from app.models import Customer, Order, Organization, Product, Quote

DASHBOARD_URL = "/api/dashboard/overview"
BUSINESS_TIMEZONE = ZoneInfo("America/Sao_Paulo")


def get_organization(
    db: Session,
    slug: str,
) -> Organization:
    organization = db.scalar(select(Organization).where(Organization.slug == slug))
    assert organization is not None
    return organization


def test_dashboard_requires_authentication(
    client: TestClient,
) -> None:
    response = client.get(DASHBOARD_URL)

    assert response.status_code == 401


def test_dashboard_starts_healthy_and_isolates_other_company(
    client: TestClient,
) -> None:
    headers = login(client)

    response = client.get(
        DASHBOARD_URL,
        headers=headers,
    )

    assert response.status_code == 200

    body = response.json()
    summary = body["summary"]

    assert body["health"] == "healthy"
    assert body["alerts"] == []
    assert Decimal(summary["sales_today"]) == Decimal(0)
    assert summary["orders_in_preparation"] == 0
    assert summary["blocked_recipes"] == 0
    assert summary["critical_stock_items"] == 0
    assert summary["fiscal_attention"] == 0
    assert summary["active_employees"] == 0
    assert summary["open_employee_records"] == 0
    assert summary["management_available"] is True
    assert summary["financial_balance"] is None
    assert summary["financial_available"] is False


def test_dashboard_returns_real_company_indicators(
    client: TestClient,
    db: Session,
) -> None:
    organization = get_organization(db, "empresa-a")

    customer = Customer(
        organization_id=organization.id,
        code="CLI-TEST-003",
        name="Cliente do painel",
        phone="35988887777",
    )
    db.add(customer)
    db.flush()

    db.add_all(
        [
            Product(
                organization_id=organization.id,
                name="Produto crítico",
                price=Decimal("15.00"),
                stock_quantity=Decimal(1),
                min_stock_quantity=Decimal(5),
            ),
            Order(
                organization_id=organization.id,
                customer_id=customer.id,
                status="in_preparation",
                total_amount=Decimal("75.00"),
            ),
            Order(
                organization_id=organization.id,
                customer_id=customer.id,
                status="completed",
                total_amount=Decimal("150.00"),
            ),
            Quote(
                organization_id=organization.id,
                customer_id=customer.id,
                status="pending",
                valid_until=(
                    datetime.now(BUSINESS_TIMEZONE).date() - timedelta(days=1)
                ),
                total_amount=Decimal("90.00"),
            ),
        ]
    )
    db.commit()

    headers = login(client)

    response = client.get(
        DASHBOARD_URL,
        headers=headers,
    )

    assert response.status_code == 200

    body = response.json()
    summary = body["summary"]
    alert_ids = {alert["id"] for alert in body["alerts"]}

    assert body["health"] == "critical"
    assert Decimal(summary["sales_today"]) == Decimal("150.00")
    assert summary["orders_in_preparation"] == 1
    assert summary["critical_stock_items"] == 1
    assert summary["blocked_recipes"] == 0
    assert summary["fiscal_attention"] == 0

    assert alert_ids == {
        "critical-stock",
        "expired-quotes",
        "orders-in-preparation",
    }

    critical_stock = next(
        alert for alert in body["alerts"] if alert["id"] == "critical-stock"
    )

    assert critical_stock["severity"] == "critical"
    assert critical_stock["count"] == 1
    assert critical_stock["source"] == "Produtos e estoque"
    assert critical_stock["action_route"] == "/products"


def test_dashboard_hides_management_summary_from_member(
    client: TestClient,
) -> None:
    headers = login(
        client,
        "membro@gestoria.dev",
    )

    response = client.get(
        DASHBOARD_URL,
        headers=headers,
    )

    assert response.status_code == 200

    summary = response.json()["summary"]

    assert summary["management_available"] is False
    assert summary["active_employees"] is None
    assert summary["open_employee_records"] is None
