from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CopilotToolAuditLog, Customer, Order, Organization
from app.services.copilot import recognize_intent


def login(
    client: TestClient,
    email: str = "lucas@gestoria.dev",
    password: str = "SenhaForte@123",
) -> dict[str, str]:
    client.cookies.clear()
    response = client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": password,
        },
        headers={"X-CSRF-Protection": "1"},
    )
    assert response.status_code == 200

    token = client.cookies.get(settings.session_cookie_name)
    client.cookies.clear()

    return {
        "Cookie": f"{settings.session_cookie_name}={token}",
        "X-CSRF-Protection": "1",
    }


def get_organization(
    db: Session,
    slug: str,
) -> Organization:
    organization = db.scalar(select(Organization).where(Organization.slug == slug))
    assert organization is not None
    return organization


def test_copilot_requires_authentication(client: TestClient) -> None:
    response = client.post(
        "/api/copilot/chat",
        json={"message": "Quais pedidos estão em produção?"},
    )

    assert response.status_code == 401


def test_copilot_returns_empty_order_result(client: TestClient) -> None:
    headers = login(client)

    response = client.post(
        "/api/copilot/chat",
        headers=headers,
        json={"message": "Quais pedidos estão em produção?"},
    )

    assert response.status_code == 200
    body = response.json()

    assert body["status"] == "answered"
    assert body["intent"] == "orders_in_preparation"
    assert body["message"] == "Não há pedidos em preparo neste momento."
    assert body["tool"] == {
        "name": "orders_in_preparation",
        "status": "empty",
    }
    assert body["items"] == []
    assert body["actions"][0]["path"] == "/pedidos"
    assert body["confirmation"] is None


def test_copilot_lists_only_current_organization_orders(
    client: TestClient,
    db: Session,
) -> None:
    organization = get_organization(db, "empresa-a")
    other_organization = get_organization(db, "empresa-b")

    customer = Customer(
        organization_id=organization.id,
        name="Cliente do Copiloto",
        phone="35988887777",
    )
    db.add(customer)
    db.flush()

    other_customer = db.scalar(
        select(Customer).where(Customer.organization_id == other_organization.id)
    )
    assert other_customer is not None

    current_orders = [
        Order(
            organization_id=organization.id,
            customer_id=customer.id,
            status="in_preparation",
            total_amount=Decimal(index + 1) * Decimal("10.00"),
        )
        for index in range(6)
    ]

    db.add_all(
        [
            *current_orders,
            Order(
                organization_id=organization.id,
                customer_id=customer.id,
                status="completed",
                total_amount=Decimal("999.00"),
            ),
            Order(
                organization_id=other_organization.id,
                customer_id=other_customer.id,
                status="in_preparation",
                total_amount=Decimal("500.00"),
            ),
        ]
    )
    db.commit()

    headers = login(client)
    response = client.post(
        "/api/copilot/chat",
        headers=headers,
        json={"message": "Quais PEDIDOS estão em PRODUÇÃO?"},
    )

    assert response.status_code == 200
    body = response.json()

    assert body["message"] == "Existem 6 pedidos em preparo."
    assert body["tool"]["status"] == "success"
    assert len(body["items"]) == 5
    assert all(item["title"] == "Cliente do Copiloto" for item in body["items"])
    assert all("R$" in item["description"] for item in body["items"])
    assert "Empresa B" not in response.text
    assert "500,00" not in response.text


def test_copilot_guides_mapped_intent_without_inventing_data(
    client: TestClient,
) -> None:
    headers = login(client)

    response = client.post(
        "/api/copilot/chat",
        headers=headers,
        json={"message": "Quais produtos estão com estoque crítico?"},
    )

    assert response.status_code == 200
    body = response.json()

    assert body["status"] == "guided"
    assert body["intent"] == "critical_stock"
    assert body["tool"] is None
    assert body["items"] == []
    assert body["actions"] == [
        {
            "id": "open-products",
            "label": "Abrir produtos",
            "path": "/produtos",
            "requires_confirmation": False,
        }
    ]


def test_copilot_hides_restricted_management_actions_from_member(
    client: TestClient,
    db: Session,
) -> None:
    headers = login(client, "membro@gestoria.dev")

    response = client.post(
        "/api/copilot/chat",
        headers=headers,
        json={"message": "Quantos funcionários ativos temos?"},
    )

    assert response.status_code == 403
    body = response.json()

    assert "exige permissão" in body["detail"]
    assert "actions" not in body
    audit = db.scalar(select(CopilotToolAuditLog))
    assert audit.status == "denied"
    assert audit.tool_name == "active_employees"


def test_copilot_handles_unknown_question(client: TestClient) -> None:
    headers = login(client)

    response = client.post(
        "/api/copilot/chat",
        headers=headers,
        json={"message": "Qual é a previsão do tempo?"},
    )

    assert response.status_code == 200
    body = response.json()

    assert body["intent"] == "unknown"
    assert body["status"] == "guided"
    assert body["tool"] is None
    assert body["items"] == []
    assert body["actions"][0]["path"] == "/dashboard"


@pytest.mark.parametrize(
    ("message", "expected_intent"),
    [
        ("O que precisa da minha atenção hoje?", "daily_priorities"),
        ("Quais pedidos estão em produção?", "orders_in_preparation"),
        ("Quais produtos estão com estoque crítico?", "critical_stock"),
        (
            "Quais orçamentos precisam de acompanhamento?",
            "quotes_follow_up",
        ),
        ("Quais notas fiscais exigem atenção?", "fiscal_attention"),
        (
            "O que posso produzir com o estoque atual?",
            "production_availability",
        ),
        ("Quanto vendemos hoje?", "sales_today"),
        ("Quais são os nossos principais clientes?", "top_customers"),
        ("Quantos funcionários ativos temos?", "active_employees"),
        (
            "Como estão distribuídos os centros de custo?",
            "cost_centers_summary",
        ),
    ],
)
def test_copilot_recognizes_the_ten_mapped_questions(
    message: str,
    expected_intent: str,
) -> None:
    assert recognize_intent(message) == expected_intent


@pytest.mark.parametrize(
    "payload",
    [
        {"message": ""},
        {"message": "   "},
        {"message": "a" * 501},
        {
            "message": "Quais pedidos estão em produção?",
            "organization_id": "não-pode-ser-enviado",
        },
    ],
)
def test_copilot_rejects_invalid_payloads(
    client: TestClient,
    payload: dict[str, str],
) -> None:
    headers = login(client)

    response = client.post(
        "/api/copilot/chat",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 422
