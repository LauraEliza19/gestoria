"""Contas a pagar e receber: vencimento, baixa, anexos e auditoria."""

from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_api import login, page_items
from test_finance_api import create_category

from app.models import FinanceAttachment, FinanceAuditEvent, OrganizationMember
from app.models.finance import business_today

PDF = b"%PDF-1.4\n%comprovante\n"
FIVE_MB = 5 * 1024 * 1024


def new_entry(
    client: TestClient,
    headers: dict[str, str],
    category_id: str,
    *,
    entry_type: str = "expense",
    status: str = "pending",
    amount: str = "100.00",
    transaction_date: date | None = None,
    due_date: date | None = None,
    description: str = "Conta de teste",
) -> dict:
    payload = {
        "category_id": category_id,
        "description": description,
        "amount": amount,
        "entry_type": entry_type,
        "status": status,
        "transaction_date": (transaction_date or business_today()).isoformat(),
    }
    if due_date is not None:
        payload["due_date"] = due_date.isoformat()
    response = client.post("/api/finance/entries", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def settle(client, headers, entry, **payload):
    return client.post(
        f"/api/finance/entries/{entry['id']}/settle",
        headers=headers,
        json={"expected_version": entry["version"], **payload},
    )


def upload(
    client, headers, entry_id, content=PDF, content_type="application/pdf", name="a.pdf"
):
    request_headers = dict(headers)
    if content_type is not None:
        request_headers["Content-Type"] = content_type
    return client.post(
        f"/api/finance/entries/{entry_id}/attachments",
        params={"file_name": name},
        headers=request_headers,
        content=content,
    )


@pytest.fixture
def owner(client: TestClient):
    headers = login(client)
    category = create_category(client, headers, "Contas")
    return headers, category["id"]


def approve_member(db: Session) -> None:
    member = db.scalar(
        select(OrganizationMember).where(OrganizationMember.role == "member")
    )
    member.finance_access_approved = True
    db.commit()


# ---------------------------------------------------------------- vencimento


@pytest.mark.parametrize(
    "transaction_date",
    ["2026-01-01", "2026-02-28", "2024-02-29", "2026-12-31", "2027-06-15"],
)
def test_due_date_defaults_to_transaction_date(client, owner, transaction_date):
    headers, category_id = owner
    entry = new_entry(
        client,
        headers,
        category_id,
        transaction_date=date.fromisoformat(transaction_date),
    )
    assert entry["due_date"] == transaction_date


@pytest.mark.parametrize("offset", [-60, -1, 0, 1, 90])
def test_explicit_due_date_is_kept(client, owner, offset):
    headers, category_id = owner
    due = business_today() + timedelta(days=offset)
    entry = new_entry(client, headers, category_id, due_date=due)
    assert entry["due_date"] == due.isoformat()
    stored = client.get(f"/api/finance/entries/{entry['id']}", headers=headers).json()
    assert stored["due_date"] == due.isoformat()


@pytest.mark.parametrize(
    ("offset", "expected"),
    [(-30, True), (-1, True), (0, False), (1, False), (30, False)],
)
def test_pending_entry_overdue_flag(client, owner, offset, expected):
    headers, category_id = owner
    entry = new_entry(
        client, headers, category_id, due_date=business_today() + timedelta(offset)
    )
    assert entry["is_overdue"] is expected


@pytest.mark.parametrize("status", ["paid", "cancelled"])
def test_paid_or_cancelled_entry_is_never_overdue(client, owner, status):
    headers, category_id = owner
    entry = new_entry(
        client,
        headers,
        category_id,
        status=status,
        due_date=business_today() - timedelta(days=10),
    )
    assert entry["is_overdue"] is False


@pytest.mark.parametrize("bad_date", ["2026-13-01", "2026-02-30", "amanhã", ""])
def test_invalid_due_date_is_rejected(client, owner, bad_date):
    headers, category_id = owner
    response = client.post(
        "/api/finance/entries",
        headers=headers,
        json={
            "category_id": category_id,
            "description": "Data inválida",
            "amount": "1.00",
            "entry_type": "expense",
            "transaction_date": "2026-10-19",
            "due_date": bad_date,
        },
    )
    assert response.status_code == 422


def test_due_date_can_be_changed_and_change_is_audited(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id, due_date=date(2026, 11, 1))
    response = client.patch(
        f"/api/finance/entries/{entry['id']}",
        headers=headers,
        json={"expected_version": 1, "due_date": "2026-11-20"},
    )
    assert response.status_code == 200
    assert response.json()["due_date"] == "2026-11-20"
    history = client.get(
        f"/api/finance/entries/{entry['id']}/history", headers=headers
    ).json()
    assert history[0]["changes"]["due_date"] == {
        "before": "2026-11-01",
        "after": "2026-11-20",
    }


# ------------------------------------------------------- contas a pagar/receber


@pytest.mark.parametrize("entry_type", ["expense", "income"])
def test_sort_by_due_date_lists_earliest_first(client, owner, entry_type):
    headers, category_id = owner
    today = business_today()
    for offset in (20, -5, 3, 0):
        new_entry(
            client,
            headers,
            category_id,
            entry_type=entry_type,
            due_date=today + timedelta(days=offset),
        )
    response = client.get(
        "/api/finance/entries",
        params={"entry_type": entry_type, "sort": "due_date"},
        headers=headers,
    )
    assert response.status_code == 200
    dues = [item["due_date"] for item in page_items(response)]
    assert dues == sorted(dues)
    assert len(dues) == 4


def test_payables_and_receivables_are_separated(client, owner):
    headers, category_id = owner
    new_entry(client, headers, category_id, entry_type="expense")
    new_entry(client, headers, category_id, entry_type="income")
    new_entry(client, headers, category_id, entry_type="income")
    payables = page_items(client.get(
        "/api/finance/entries?entry_type=expense&sort=due_date", headers=headers
    ))
    receivables = page_items(client.get(
        "/api/finance/entries?entry_type=income&sort=due_date", headers=headers
    ))
    assert {item["entry_type"] for item in payables} == {"expense"}
    assert {item["entry_type"] for item in receivables} == {"income"}
    assert (len(payables), len(receivables)) == (1, 2)


@pytest.mark.parametrize("sort", ["vencimento", "amount", "DUE_DATE", "due_date;"])
def test_invalid_sort_is_rejected(client, owner, sort):
    headers, _ = owner
    response = client.get(f"/api/finance/entries?sort={sort}", headers=headers)
    assert response.status_code == 422


def test_default_sort_is_unchanged(client, owner):
    headers, category_id = owner
    old = new_entry(client, headers, category_id, transaction_date=date(2026, 1, 1))
    recent = new_entry(client, headers, category_id, transaction_date=date(2026, 9, 1))
    ids = [
        item["id"]
        for item in page_items(client.get("/api/finance/entries", headers=headers))
    ]
    assert ids == [recent["id"], old["id"]]


# ---------------------------------------------------------------------- baixa


@pytest.mark.parametrize("entry_type", ["expense", "income"])
def test_settle_pending_entry(client, owner, entry_type):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id, entry_type=entry_type)
    response = settle(client, headers, entry)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "paid"
    assert body["paid_at"] is not None
    assert body["version"] == entry["version"] + 1
    assert body["is_overdue"] is False


@pytest.mark.parametrize("days_ago", [0, 1, 15, 400])
def test_settle_with_explicit_date(client, owner, days_ago):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    paid_at = datetime(2026, 6, 15, 12, tzinfo=UTC) - timedelta(days=days_ago)
    response = settle(client, headers, entry, paid_at=paid_at.isoformat())
    assert response.status_code == 200
    assert response.json()["paid_at"].startswith(paid_at.date().isoformat())


@pytest.mark.parametrize(
    ("entry_type", "field"), [("income", "total_income"), ("expense", "total_expense")]
)
def test_settled_entry_enters_realized_summary(client, owner, entry_type, field):
    headers, category_id = owner
    entry = new_entry(
        client, headers, category_id, entry_type=entry_type, amount="250.75"
    )
    before = client.get("/api/finance/summary", headers=headers).json()
    assert before[field] == "0"
    assert settle(client, headers, entry).status_code == 200
    after = client.get("/api/finance/summary", headers=headers).json()
    assert after[field] == "250.75"


@pytest.mark.parametrize("status", ["paid", "cancelled"])
def test_only_pending_entries_can_be_settled(client, owner, status):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id, status=status)
    response = settle(client, headers, entry)
    assert response.status_code == 409


def test_settling_twice_is_rejected(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    first = settle(client, headers, entry)
    assert first.status_code == 200
    again = settle(client, headers, first.json())
    assert again.status_code == 409


@pytest.mark.parametrize("stale_version", [2, 3, 10, 999])
def test_settle_rejects_wrong_version(client, owner, stale_version):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    response = client.post(
        f"/api/finance/entries/{entry['id']}/settle",
        headers=headers,
        json={"expected_version": stale_version},
    )
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "finance_entry_conflict"
    assert detail["current"]["status"] == "pending"


@pytest.mark.parametrize(
    "payload",
    [{}, {"expected_version": 0}, {"expected_version": -1}, {"expected_version": "x"}],
)
def test_settle_requires_valid_version(client, owner, payload):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    response = client.post(
        f"/api/finance/entries/{entry['id']}/settle", headers=headers, json=payload
    )
    assert response.status_code == 422


@pytest.mark.parametrize("paid_at", ["ontem", "2026-02-30T10:00:00Z", "12345abc"])
def test_settle_rejects_invalid_date(client, owner, paid_at):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    assert settle(client, headers, entry, paid_at=paid_at).status_code == 422


def test_settle_unknown_entry_returns_404(client, owner):
    headers, _ = owner
    response = client.post(
        "/api/finance/entries/00000000-0000-0000-0000-000000000000/settle",
        headers=headers,
        json={"expected_version": 1},
    )
    assert response.status_code == 404


def test_settle_requires_csrf_header(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    no_csrf = {"Cookie": headers["Cookie"]}
    client.headers.pop("X-CSRF-Protection", None)
    response = client.post(
        f"/api/finance/entries/{entry['id']}/settle",
        headers=no_csrf,
        json={"expected_version": 1},
    )
    assert response.status_code == 403


def test_settle_permissions_and_isolation(client: TestClient, db: Session, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)

    member_headers = login(client, "membro@gestoria.dev")
    assert settle(client, member_headers, entry).status_code == 403
    approve_member(db)
    assert settle(client, member_headers, entry).status_code == 403

    other_headers = login(client, "empresa-b@gestoria.dev")
    assert settle(client, other_headers, entry).status_code == 404

    stored = client.get(f"/api/finance/entries/{entry['id']}", headers=headers).json()
    assert stored["status"] == "pending"


# --------------------------------------------------------------------- anexos


@pytest.mark.parametrize(
    "content_type",
    [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/xml",
        "text/xml",
        "application/pdf; charset=binary",
        "APPLICATION/PDF",
    ],
)
def test_upload_accepts_allowed_types(client, owner, content_type):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    response = upload(
        client, headers, entry["id"], content=b"conteudo", content_type=content_type
    )
    assert response.status_code == 201, response.text
    assert response.json()["content_type"] == content_type.split(";")[0].lower()
    assert response.json()["size_bytes"] == len(b"conteudo")


@pytest.mark.parametrize(
    "content_type",
    [
        "text/html",
        "application/zip",
        "image/gif",
        "application/octet-stream",
        "text/plain",
        "application/javascript",
    ],
)
def test_upload_rejects_other_types(client, owner, content_type):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    response = upload(client, headers, entry["id"], content_type=content_type)
    assert response.status_code == 422
    assert (
        client.get(
            f"/api/finance/entries/{entry['id']}/attachments", headers=headers
        ).json()
        == []
    )


def test_upload_rejects_empty_file(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    assert upload(client, headers, entry["id"], content=b"").status_code == 422


@pytest.mark.parametrize(
    ("size", "expected"),
    [
        (1, 201),
        (FIVE_MB - 1, 201),
        (FIVE_MB, 201),
        (FIVE_MB + 1, 413),
        (FIVE_MB * 2, 413),
    ],
)
def test_upload_size_limit(client, owner, size, expected):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    response = upload(client, headers, entry["id"], content=b"%" * size)
    assert response.status_code == expected


@pytest.mark.parametrize(
    ("sent_name", "stored_name"),
    [
        ("boleto.pdf", "boleto.pdf"),
        ("C:\\fakepath\\boleto.pdf", "boleto.pdf"),
        ("../../etc/boleto.pdf", "boleto.pdf"),
        ("recibo de março ção.pdf", "recibo de março ção.pdf"),
        ("pasta/", "anexo"),
    ],
)
def test_upload_cleans_file_name(client, owner, sent_name, stored_name):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    response = upload(client, headers, entry["id"], name=sent_name)
    assert response.status_code == 201
    assert response.json()["file_name"] == stored_name


def test_upload_requires_file_name(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    response = client.post(
        f"/api/finance/entries/{entry['id']}/attachments",
        headers={**headers, "Content-Type": "application/pdf"},
        content=PDF,
    )
    assert response.status_code == 422


def test_upload_to_unknown_entry_returns_404(client, owner):
    headers, _ = owner
    response = upload(client, headers, "00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


@pytest.mark.parametrize("status", ["pending", "paid", "cancelled"])
def test_attachments_allowed_in_any_status(client, owner, status):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id, status=status)
    assert upload(client, headers, entry["id"]).status_code == 201


@pytest.mark.parametrize(
    "content",
    [
        PDF,
        b"\x89PNG\r\n\x1a\n" + bytes(range(256)),
        b"<?xml version='1.0'?><nfe/>",
    ],
)
def test_download_returns_exact_bytes(client, owner, content):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    attachment = upload(client, headers, entry["id"], content=content).json()
    response = client.get(
        f"/api/finance/entries/{entry['id']}/attachments/{attachment['id']}/download",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.content == content
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("attachment;")


def test_download_keeps_accented_name(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    attachment = upload(client, headers, entry["id"], name="nota fiscal ção.pdf").json()
    response = client.get(
        f"/api/finance/entries/{entry['id']}/attachments/{attachment['id']}/download",
        headers=headers,
    )
    disposition = response.headers["content-disposition"]
    assert "filename*=UTF-8''nota%20fiscal%20%C3%A7%C3%A3o.pdf" in disposition


def test_list_attachments_newest_first(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    names = ["primeiro.pdf", "segundo.pdf", "terceiro.pdf"]
    for name in names:
        assert upload(client, headers, entry["id"], name=name).status_code == 201
    listed = client.get(
        f"/api/finance/entries/{entry['id']}/attachments", headers=headers
    ).json()
    assert sorted(item["file_name"] for item in listed) == sorted(names)
    assert all("content" not in item for item in listed)


def test_attachments_do_not_leak_between_entries(client, owner):
    headers, category_id = owner
    first = new_entry(client, headers, category_id)
    second = new_entry(client, headers, category_id)
    attachment = upload(client, headers, first["id"]).json()
    assert (
        client.get(
            f"/api/finance/entries/{second['id']}/attachments", headers=headers
        ).json()
        == []
    )
    wrong_entry = client.get(
        f"/api/finance/entries/{second['id']}/attachments/{attachment['id']}/download",
        headers=headers,
    )
    assert wrong_entry.status_code == 404
    assert (
        client.delete(
            f"/api/finance/entries/{second['id']}/attachments/{attachment['id']}",
            headers=headers,
        ).status_code
        == 404
    )


def test_delete_attachment(client, db, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    attachment = upload(client, headers, entry["id"]).json()
    response = client.delete(
        f"/api/finance/entries/{entry['id']}/attachments/{attachment['id']}",
        headers=headers,
    )
    assert response.status_code == 204
    assert (
        client.get(
            f"/api/finance/entries/{entry['id']}/attachments", headers=headers
        ).json()
        == []
    )
    assert db.scalars(select(FinanceAttachment)).all() == []
    again = client.delete(
        f"/api/finance/entries/{entry['id']}/attachments/{attachment['id']}",
        headers=headers,
    )
    assert again.status_code == 404


def test_attachment_permissions(client: TestClient, db: Session, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    attachment = upload(client, headers, entry["id"]).json()
    base = f"/api/finance/entries/{entry['id']}/attachments"
    download = f"{base}/{attachment['id']}/download"

    member_headers = login(client, "membro@gestoria.dev")
    assert client.get(base, headers=member_headers).status_code == 403
    assert client.get(download, headers=member_headers).status_code == 403

    approve_member(db)
    assert client.get(base, headers=member_headers).status_code == 200
    assert client.get(download, headers=member_headers).status_code == 200
    assert upload(client, member_headers, entry["id"]).status_code == 403
    assert (
        client.delete(f"{base}/{attachment['id']}", headers=member_headers).status_code
        == 403
    )


def test_attachments_are_isolated_by_organization(client: TestClient, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    attachment = upload(client, headers, entry["id"]).json()
    base = f"/api/finance/entries/{entry['id']}/attachments"
    other = login(client, "empresa-b@gestoria.dev")
    assert client.get(base, headers=other).status_code == 404
    assert (
        client.get(f"{base}/{attachment['id']}/download", headers=other).status_code
        == 404
    )
    assert upload(client, other, entry["id"]).status_code == 404
    assert client.delete(f"{base}/{attachment['id']}", headers=other).status_code == 404


# ----------------------------------------------------------------- auditoria


def test_creation_audit_records_due_date(client, db, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id, due_date=date(2026, 12, 10))
    event = db.scalar(
        select(FinanceAuditEvent).where(FinanceAuditEvent.event_type == "entry_created")
    )
    assert event.entity_id.hex == entry["id"].replace("-", "")
    assert event.document["due_date"] == "2026-12-10"


def test_settlement_is_in_entry_history(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    settled = settle(client, headers, entry).json()
    history = client.get(
        f"/api/finance/entries/{entry['id']}/history", headers=headers
    ).json()
    assert [event["event_type"] for event in history] == [
        "entry_settled",
        "entry_created",
    ]
    assert history[0]["version"] == settled["version"]
    assert history[0]["actor_name"] == "Lucas Teste"
    assert history[0]["changes"]["status"] == {"before": "pending", "after": "paid"}
    assert history[0]["changes"]["paid_at"]["before"] is None
    assert history[0]["changes"]["paid_at"]["after"]


def test_attachment_events_are_in_history(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    attachment = upload(client, headers, entry["id"], name="boleto.pdf").json()
    client.delete(
        f"/api/finance/entries/{entry['id']}/attachments/{attachment['id']}",
        headers=headers,
    )
    history = client.get(
        f"/api/finance/entries/{entry['id']}/history", headers=headers
    ).json()
    by_type = {event["event_type"]: event for event in history}
    assert by_type["attachment_added"]["changes"]["attachment"] == {
        "before": None,
        "after": "boleto.pdf",
    }
    assert by_type["attachment_removed"]["changes"]["attachment"] == {
        "before": "boleto.pdf",
        "after": None,
    }


def test_audit_search_includes_new_events(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id, description="Aluguel auditado")
    upload(client, headers, entry["id"], name="contrato.pdf")
    settle(client, headers, entry)
    response = client.get(
        "/api/finance/audit?query=Aluguel%20auditado", headers=headers
    )
    assert response.status_code == 200
    types = [item["event_type"] for item in response.json()["items"]]
    assert sorted(types) == ["attachment_added", "entry_created", "entry_settled"]


def test_audit_search_finds_attachment_by_file_name(client, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    upload(client, headers, entry["id"], name="comprovante-pix.pdf")
    response = client.get(
        "/api/finance/audit?after_value=comprovante-pix", headers=headers
    ).json()
    assert response["total"] == 1
    assert response["items"][0]["event_type"] == "attachment_added"


def test_rejected_operations_leave_no_audit(client, db, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id, status="paid")
    settle(client, headers, entry)
    upload(client, headers, entry["id"], content_type="text/html")
    upload(client, headers, entry["id"], content=b"%" * (FIVE_MB + 1))
    events = db.scalars(select(FinanceAuditEvent.event_type)).all()
    assert sorted(events) == ["category_created", "entry_created"]


def test_member_cannot_read_entry_history(client: TestClient, db: Session, owner):
    headers, category_id = owner
    entry = new_entry(client, headers, category_id)
    settle(client, headers, entry)
    approve_member(db)
    member_headers = login(client, "membro@gestoria.dev")
    response = client.get(
        f"/api/finance/entries/{entry['id']}/history", headers=member_headers
    )
    assert response.status_code == 403
