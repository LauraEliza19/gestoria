import csv
import io
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import select
from test_api import login

from app.models import (
    FinanceAuditEvent,
    FiscalDocument,
    FiscalEvent,
    OrderAuditEvent,
    Organization,
    User,
)
from app.models.copilot import CopilotToolAuditLog
from app.models.order_operation import OrderOperation


@pytest.fixture
def events(db):
    org = db.scalar(select(Organization).where(Organization.slug == "empresa-a"))
    other = db.scalar(select(Organization).where(Organization.slug == "empresa-b"))
    actor = db.scalar(select(User).where(User.email == "lucas@gestoria.dev"))
    moment = datetime(2026, 11, 10, 12, tzinfo=UTC)
    document = FiscalDocument(
        organization_id=org.id,
        document_type="entrada",
        number="1",
        participant_name="Fornecedor",
        issue_date=date(2026, 11, 10),
        is_legacy=True,
    )
    operation = OrderOperation(
        organization_id=org.id,
        actor_id=actor.id,
        idempotency_key=uuid.uuid4(),
        request_hash="a" * 64,
        envelope={},
    )
    db.add_all([document, operation])
    db.flush()
    db.add_all(
        [
            FinanceAuditEvent(
                organization_id=org.id,
                actor_id=actor.id,
                event_type="entry_updated",
                entity_id=uuid.uuid4(),
                document={"before": {"amount": "10"}, "after": {"amount": "20"}},
                created_at=moment,
            ),
            FiscalEvent(
                organization_id=org.id,
                actor_id=actor.id,
                document_id=document.id,
                action="created",
                detail={"note": 'texto; "aspas"\nlinha'},
                created_at=moment + timedelta(minutes=3),
            ),
            OrderAuditEvent(
                organization_id=org.id,
                actor_id=actor.id,
                operation_id=operation.id,
                event_type="prepared",
                document={"reason": None},
                created_at=moment + timedelta(minutes=1),
            ),
            CopilotToolAuditLog(
                organization_id=org.id,
                user_id=actor.id,
                tool_name="=FORMULA()",
                status="denied",
                input_payload={
                    "password": "secret-password-123",
                    "prompt": "private-question",
                    "nested": [{"token": "private-token"}],
                    "arbitrary": "private-personal-data",
                },
                execution_time_ms=1,
                created_at=moment + timedelta(minutes=2),
            ),
            FinanceAuditEvent(
                organization_id=other.id,
                actor_id=actor.id,
                event_type="private",
                entity_id=uuid.uuid4(),
                document={"private": True},
                created_at=moment,
            ),
        ]
    )
    db.commit()


def test_union_pagination_and_isolation(client, events):
    headers = login(client)
    pages = [
        client.get(f"/api/audit?page={page}&page_size=2", headers=headers).json()
        for page in (1, 2)
    ]
    assert pages[0]["total"] == pages[1]["total"] == 4
    assert [p["page"] for p in pages] == [1, 2]
    assert all(p["page_size"] == 2 for p in pages)
    assert pages[0]["has_next"] and not pages[1]["has_next"]
    items = pages[0]["items"] + pages[1]["items"]
    assert [item["module"] for item in items] == [
        "Fiscal",
        "Copiloto",
        "Pedidos",
        "Financeiro",
    ]
    assert [item["created_at"] for item in items] == sorted(
        (item["created_at"] for item in items), reverse=True
    )
    assert all(item["origin"] == "unknown" for item in items)
    assert len({item["id"] for item in items}) == 4
    assert {item["module"] for item in items} == {
        "Financeiro",
        "Fiscal",
        "Pedidos",
        "Copiloto",
    }
    assert all(item["actor_name"] == "Lucas Teste" for item in items)
    assert all(item["created_at"].endswith(("Z", "+00:00")) for item in items)
    finance = next(item for item in items if item["module"] == "Financeiro")
    assert finance["data"]["before"]["amount"] == "10"
    assert finance["result"] == "not_recorded"
    assert client.get("/api/audit?query=private", headers=headers).json()["total"] == 0


def test_filters_and_export(client, events):
    headers = login(client)
    for filters in [
        "module=Copiloto",
        "result=denied",
        "actor=lucas&action=FORMULA",
        "origin=unknown&module=Copiloto",
        "entity=Documento",
        "query=aspas",
    ]:
        result = client.get("/api/audit?" + filters, headers=headers)
        assert result.status_code == 200, result.text
        assert result.json()["total"] == 1
    assert (
        client.get(
            "/api/audit?start_date=2026-11-10&end_date=2026-11-10", headers=headers
        ).json()["total"]
        == 4
    )
    assert (
        client.get("/api/audit?start_date=2026-11-11", headers=headers).json()["total"]
        == 0
    )
    assert (
        client.get("/api/audit?end_date=2026-11-09", headers=headers).json()["total"]
        == 0
    )
    response = client.get("/api/audit/export", headers=headers)
    assert response.status_code == 200
    rows = list(
        csv.reader(io.StringIO(response.content.decode("utf-8-sig")), delimiter=";")
    )
    assert len(rows) == 5
    assert any(row[7] == "'=FORMULA()" for row in rows[1:])
    filtered = client.get("/api/audit/export?module=Fiscal", headers=headers)
    assert (
        len(
            list(
                csv.reader(
                    io.StringIO(filtered.content.decode("utf-8-sig")), delimiter=";"
                )
            )
        )
        == 2
    )


def test_access_and_validation(client):
    for path in ("/api/audit", "/api/audit/export"):
        assert client.get(path).status_code == 401
    member = login(client, "membro@gestoria.dev")
    for path in ("/api/audit", "/api/audit/export"):
        assert client.get(path, headers=member).status_code == 403
    owner = login(client)
    for query in (
        "page=0",
        "page_size=101",
        "module=unknown",
        "start_date=2026-11-11&end_date=2026-11-10",
    ):
        assert client.get("/api/audit?" + query, headers=owner).status_code == 422
    assert (
        client.get(
            "/api/audit/export?start_date=2026-11-11&end_date=2026-11-10", headers=owner
        ).status_code
        == 422
    )


def csv_rows(response):
    assert response.status_code == 200, response.text
    return list(
        csv.reader(io.StringIO(response.content.decode("utf-8-sig")), delimiter=";")
    )


def test_filters_run_before_pagination_and_empty_page(client, events):
    headers = login(client)
    # Finance is the oldest event and would disappear if filtering followed LIMIT.
    response = client.get(
        "/api/audit?module=Financeiro&page_size=1", headers=headers
    ).json()
    assert response["total"] == 1
    assert response["page"] == 1
    assert response["has_next"] is False
    assert len(response["items"]) == 1
    assert response["items"][0]["module"] == "Financeiro"
    empty = client.get(
        "/api/audit?module=Financeiro&page_size=1&page=2", headers=headers
    ).json()
    assert empty == {
        "items": [],
        "total": 1,
        "page": 2,
        "page_size": 1,
        "has_next": False,
    }


@pytest.mark.parametrize(
    "filters",
    [
        "module=Fiscal&actor=lucas&action=created&origin=unknown&start_date=2026-11-10&end_date=2026-11-10",
        "result=denied&entity=ferramenta",
        "query=aspas",
        "module=Financeiro",
        "query=private",
    ],
)
def test_csv_matches_filtered_ids_and_tenant(client, events, filters):
    headers = login(client)
    listing = client.get("/api/audit?" + filters, headers=headers).json()
    rows = csv_rows(client.get("/api/audit/export?" + filters, headers=headers))
    assert [row[0] for row in rows[1:]] == [item["id"] for item in listing["items"]]
    assert len(rows) - 1 == listing["total"]
    assert "private" not in str(rows)


def test_copilot_payload_is_not_returned_exported_or_searchable(client, events):
    headers = login(client)
    listing = client.get("/api/audit?module=Copiloto", headers=headers)
    assert listing.json()["items"][0]["data"] == {"redacted": True}
    exported = client.get("/api/audit/export?module=Copiloto", headers=headers)
    for secret in (
        "secret-password-123",
        "private-question",
        "private-token",
        "private-personal-data",
    ):
        assert secret not in listing.text
        assert secret not in exported.text
        assert (
            client.get("/api/audit", params={"query": secret}, headers=headers).json()[
                "total"
            ]
            == 0
        )
        assert (
            len(
                csv_rows(
                    client.get(
                        "/api/audit/export", params={"query": secret}, headers=headers
                    )
                )
            )
            == 1
        )


def test_other_company_cannot_read_first_company(client, events):
    headers = login(client, "empresa-b@gestoria.dev")
    listing = client.get("/api/audit", headers=headers).json()
    assert listing["total"] == 1
    assert listing["items"][0]["action"] == "private"
    rows = csv_rows(client.get("/api/audit/export", headers=headers))
    assert len(rows) == 2
    assert rows[1][0] == listing["items"][0]["id"]


def test_admin_access_and_no_mutation_routes(client, db):
    from app.models import OrganizationMember

    actor = db.scalar(select(User).where(User.email == "lucas@gestoria.dev"))
    membership = db.scalar(
        select(OrganizationMember).where(OrganizationMember.user_id == actor.id)
    )
    membership.role = "admin"
    db.commit()
    headers = login(client)
    for path in ("/api/audit", "/api/audit/export"):
        assert client.get(path, headers=headers).status_code == 200
        for method in ("post", "put", "patch", "delete"):
            assert getattr(client, method)(path, headers=headers).status_code == 405
