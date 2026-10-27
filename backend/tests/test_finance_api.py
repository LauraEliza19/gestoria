from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_api import login

from app.models import (
    FinanceAuditEvent,
    FinanceCategory,
    Organization,
    OrganizationMember,
)


def create_category(client: TestClient, headers: dict[str, str], name: str) -> dict:
    response = client.post(
        "/api/finance/categories",
        headers=headers,
        json={"name": name, "description": "Categoria de teste"},
    )
    assert response.status_code == 201
    return response.json()


def create_entry(
    client: TestClient,
    headers: dict[str, str],
    category_id: str,
    *,
    amount: str = "100.00",
    entry_type: str = "income",
    status: str = "paid",
    transaction_date: str = "2026-10-19",
) -> dict:
    response = client.post(
        "/api/finance/entries",
        headers=headers,
        json={
            "category_id": category_id,
            "description": "Lançamento de teste",
            "amount": amount,
            "entry_type": entry_type,
            "status": status,
            "transaction_date": transaction_date,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_finance_summary_filters_and_audit(client: TestClient, db: Session) -> None:
    headers = login(client)
    category = create_category(client, headers, "Receitas")
    expense_category = create_category(client, headers, "Despesas")

    create_entry(client, headers, category["id"], amount="150.00")
    create_entry(
        client,
        headers,
        expense_category["id"],
        amount="40.00",
        entry_type="expense",
    )
    create_entry(
        client,
        headers,
        category["id"],
        amount="999.00",
        status="pending",
    )

    summary = client.get("/api/finance/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json() == {
        "total_income": "150.00",
        "total_expense": "40.00",
        "balance": "110.00",
        "realized_status": "paid",
    }

    filtered = client.get(
        "/api/finance/entries?entry_type=expense&status=paid"
        "&start_date=2026-10-01&end_date=2026-10-31",
        headers=headers,
    )
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1
    assert filtered.json()[0]["entry_type"] == "expense"

    audit_events = db.scalars(select(FinanceAuditEvent)).all()
    assert {event.event_type for event in audit_events} == {
        "category_created",
        "entry_created",
    }
    assert all(
        event.organization_id == audit_events[0].organization_id
        for event in audit_events
    )


def test_finance_entry_rejects_stale_form_version(client: TestClient) -> None:
    headers = login(client)
    category = create_category(client, headers, "Concorrência")
    entry = create_entry(client, headers, category["id"])

    first_update = client.patch(
        f"/api/finance/entries/{entry['id']}",
        headers=headers,
        json={"expected_version": entry["version"], "amount": "125.00"},
    )
    assert first_update.status_code == 200
    assert first_update.json()["version"] == entry["version"] + 1

    stale_update = client.patch(
        f"/api/finance/entries/{entry['id']}",
        headers=headers,
        json={"expected_version": entry["version"], "amount": "999.00"},
    )
    assert stale_update.status_code == 409
    conflict = stale_update.json()["detail"]
    assert conflict["code"] == "finance_entry_conflict"
    assert conflict["expected_version"] == entry["version"]
    assert conflict["current"]["version"] == entry["version"] + 1
    assert conflict["current"]["amount"] == "125.00"


def test_finance_entry_history_is_readable(client: TestClient) -> None:
    headers = login(client)
    category = create_category(client, headers, "Histórico")
    entry = create_entry(client, headers, category["id"])
    response = client.patch(
        f"/api/finance/entries/{entry['id']}",
        headers=headers,
        json={"expected_version": 1, "description": "Descrição corrigida"},
    )
    assert response.status_code == 200

    history = client.get(
        f"/api/finance/entries/{entry['id']}/history",
        headers=headers,
    )
    assert history.status_code == 200
    assert [event["version"] for event in history.json()] == [2, 1]
    assert history.json()[0]["actor_name"] == "Lucas Teste"
    assert history.json()[0]["changes"]["description"] == {
        "before": "Lançamento de teste",
        "after": "Descrição corrigida",
    }


def test_finance_isolation_and_member_permission(
    client: TestClient,
    db: Session,
) -> None:
    owner_headers = login(client)
    member_headers = login(client, "membro@gestoria.dev")
    category = create_category(client, owner_headers, "Privada")
    entry = create_entry(client, owner_headers, category["id"])

    assert (
        client.get("/api/finance/categories", headers=member_headers).status_code == 403
    )
    assert client.get("/api/finance/entries", headers=member_headers).status_code == 403
    assert (
        client.patch(
            f"/api/finance/entries/{entry['id']}",
            headers=member_headers,
            json={"description": "Acesso indevido"},
        ).status_code
        == 403
    )


def test_finance_member_approved_can_read_but_not_manage(
    client: TestClient,
    db: Session,
) -> None:
    owner_headers = login(client)
    member_headers = login(client, "membro@gestoria.dev")
    category = create_category(client, owner_headers, "Leitura")
    create_entry(client, owner_headers, category["id"])

    member = db.scalar(
        select(OrganizationMember).where(OrganizationMember.role == "member")
    )
    assert member is not None
    member.finance_access_approved = True
    db.commit()

    assert client.get("/api/finance/entries", headers=member_headers).status_code == 200
    assert (
        client.post(
            "/api/finance/categories",
            headers=member_headers,
            json={"name": "Sem gerenciamento"},
        ).status_code
        == 403
    )


def test_finance_rejects_cross_organization_category_and_invalid_amount(
    client: TestClient,
    db: Session,
) -> None:
    owner_headers = login(client)
    other_organization = db.scalar(
        select(Organization).where(Organization.slug == "empresa-b")
    )
    assert other_organization is not None
    other_category = FinanceCategory(
        organization_id=other_organization.id,
        name="Categoria de outra empresa",
    )
    db.add(other_category)
    db.commit()

    cross_organization = client.post(
        "/api/finance/entries",
        headers=owner_headers,
        json={
            "category_id": str(other_category.id),
            "description": "Categoria cruzada",
            "amount": "1.00",
            "entry_type": "income",
            "transaction_date": "2026-10-19",
        },
    )
    assert cross_organization.status_code == 422

    response = client.post(
        "/api/finance/entries",
        headers=owner_headers,
        json={
            "category_id": "00000000-0000-0000-0000-000000000000",
            "description": "Valor inválido",
            "amount": "-1",
            "entry_type": "income",
            "transaction_date": "2026-10-19",
        },
    )
    assert response.status_code == 422


def test_finance_duplicate_category_rolls_back_without_audit(
    client: TestClient,
    db: Session,
) -> None:
    headers = login(client)
    create_category(client, headers, "Única")

    duplicate = client.post(
        "/api/finance/categories",
        headers=headers,
        json={"name": "Única"},
    )
    assert duplicate.status_code == 409
    assert db.scalars(
        select(FinanceCategory).where(FinanceCategory.name == "Única")
    ).one()
    assert (
        len(
            db.scalars(
                select(FinanceAuditEvent).where(
                    FinanceAuditEvent.event_type == "category_created"
                )
            ).all()
        )
        == 1
    )
