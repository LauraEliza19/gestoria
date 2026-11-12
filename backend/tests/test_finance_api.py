import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_api import login, page_items

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
    assert filtered.json()["total"] == 1
    assert page_items(filtered)[0]["entry_type"] == "expense"

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


def test_finance_member_approved_can_read_but_not_manage_or_audit(
    client: TestClient,
    db: Session,
) -> None:
    owner_headers = login(client)
    member_headers = login(client, "membro@gestoria.dev")

    category = create_category(client, owner_headers, "Leitura")
    entry = create_entry(client, owner_headers, category["id"])

    member = db.scalar(
        select(OrganizationMember).where(OrganizationMember.role == "member")
    )
    assert member is not None

    member.finance_access_approved = True
    db.commit()

    # O membro aprovado continua autorizado a consultar o Financeiro.
    assert (
        client.get(
            "/api/finance/entries",
            headers=member_headers,
        ).status_code
        == 200
    )

    # Somente owner e admin podem consultar auditoria e histórico de versões.
    assert (
        client.get(
            "/api/finance/audit",
            headers=member_headers,
        ).status_code
        == 403
    )

    assert (
        client.get(
            f"/api/finance/entries/{entry['id']}/history",
            headers=member_headers,
        ).status_code
        == 403
    )

    # O owner continua autorizado aos dois recursos protegidos.
    assert (
        client.get(
            "/api/finance/audit",
            headers=owner_headers,
        ).status_code
        == 200
    )

    assert (
        client.get(
            f"/api/finance/entries/{entry['id']}/history",
            headers=owner_headers,
        ).status_code
        == 200
    )

    # Aprovação para leitura não concede gerenciamento.
    assert (
        client.post(
            "/api/finance/categories",
            headers=member_headers,
            json={"name": "Sem gerenciamento"},
        ).status_code
        == 403
    )

    # Ao ser promovido para admin, o mesmo usuário passa a acessar a auditoria.
    member.role = "admin"
    db.commit()

    assert (
        client.get(
            "/api/finance/audit",
            headers=member_headers,
        ).status_code
        == 200
    )

    assert (
        client.get(
            f"/api/finance/entries/{entry['id']}/history",
            headers=member_headers,
        ).status_code
        == 200
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


def test_finance_audit_search_filters_by_entry_actor_and_values(
    client: TestClient,
) -> None:
    headers = login(client)
    category = create_category(
        client,
        headers,
        "Auditoria pesquisável",
    )
    entry = create_entry(
        client,
        headers,
        category["id"],
        amount="100.00",
    )

    update = client.patch(
        f"/api/finance/entries/{entry['id']}",
        headers=headers,
        json={
            "expected_version": 1,
            "amount": "175.00",
        },
    )
    assert update.status_code == 200

    response = client.get(
        "/api/finance/audit"
        "?query=Lançamento%20de%20teste"
        "&actor=Lucas"
        "&before_value=100,00"
        "&after_value=175,00",
        headers=headers,
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["total"] == 1
    assert payload["page"] == 1
    assert payload["page_size"] == 50
    assert payload["has_next"] is False

    events = payload["items"]

    assert len(events) == 1
    assert events[0]["entry_id"] == entry["id"]
    assert events[0]["actor_name"] == "Lucas Teste"
    assert events[0]["changes"]["amount"] == {
        "before": "100.00",
        "after": "175.00",
    }


def test_finance_audit_filters_before_paginating_more_than_500_events(
    client: TestClient,
    db: Session,
) -> None:
    headers = login(client)

    category = create_category(
        client,
        headers,
        "Auditoria paginada",
    )
    entry = create_entry(
        client,
        headers,
        category["id"],
    )

    organization_id = uuid.UUID(entry["organization_id"])
    entry_id = uuid.UUID(entry["id"])

    membership = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.role == "owner",
        )
    )
    assert membership is not None

    base_time = datetime(
        2026,
        1,
        1,
        tzinfo=UTC,
    )

    target_event = FinanceAuditEvent(
        organization_id=organization_id,
        actor_id=membership.user_id,
        event_type="entry_updated",
        entity_id=entry_id,
        document={
            "before": {
                "amount": "777.77",
            },
            "after": {
                "amount": "888.88",
            },
            "version": 2,
        },
        created_at=base_time,
    )

    newer_events = [
        FinanceAuditEvent(
            organization_id=organization_id,
            actor_id=membership.user_id,
            event_type="entry_updated",
            entity_id=entry_id,
            document={
                "before": {
                    "amount": f"{index}.00",
                },
                "after": {
                    "amount": f"{index + 1}.00",
                },
                "version": index + 3,
            },
            created_at=base_time + timedelta(minutes=index + 1),
        )
        for index in range(501)
    ]

    db.add(target_event)
    db.add_all(newer_events)
    db.commit()

    filtered = client.get(
        "/api/finance/audit?before_value=777,77&after_value=888,88&page=1&page_size=25",
        headers=headers,
    )

    assert filtered.status_code == 200

    filtered_payload = filtered.json()

    assert filtered_payload["total"] == 1
    assert filtered_payload["page"] == 1
    assert filtered_payload["page_size"] == 25
    assert filtered_payload["has_next"] is False
    assert len(filtered_payload["items"]) == 1
    assert filtered_payload["items"][0]["id"] == str(target_event.id)

    first_page = client.get(
        "/api/finance/audit?page=1&page_size=100",
        headers=headers,
    )

    assert first_page.status_code == 200

    first_page_payload = first_page.json()

    assert first_page_payload["total"] == 503
    assert len(first_page_payload["items"]) == 100
    assert first_page_payload["page"] == 1
    assert first_page_payload["page_size"] == 100
    assert first_page_payload["has_next"] is True

    last_page = client.get(
        "/api/finance/audit?page=6&page_size=100",
        headers=headers,
    )

    assert last_page.status_code == 200

    last_page_payload = last_page.json()

    assert last_page_payload["total"] == 503
    assert len(last_page_payload["items"]) == 3
    assert last_page_payload["page"] == 6
    assert last_page_payload["has_next"] is False
