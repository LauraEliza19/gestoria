"""Fiscal business invariants; HTTP + persisted data, not mocked repository calls."""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from order_helpers import secure_order
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from test_api import login

from app.models import (
    FiscalDocument,
    FiscalDocumentItem,
    FiscalEvent,
    FiscalStockMovement,
    Order,
    OrganizationMember,
    User,
)

URL = "/api/fiscal-documents"


def setup_sale(client):
    headers = login(client)
    customer = client.post(
        "/api/customers",
        headers=headers,
        json={
            "name": "Cliente fiscal",
            "phone": "35999998888",
            "document": "12345678901",
        },
    ).json()
    product = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": "Café fiscal",
            "price": "12.50",
            "stock_quantity": "20.000",
            "ncm_code": "09012100",
            "fiscal_origin": 0,
        },
    ).json()
    order = secure_order(
        client,
        headers=headers,
        json={
            "customer_id": customer["id"],
            "items": [{"product_id": product["id"], "quantity": "2.500"}],
        },
    )
    assert order.status_code == 201, order.text
    return headers, customer, product, order.json()


def outgoing(order, number="100"):
    return {
        "document_type": "saida",
        "order_id": order["id"],
        "number": number,
        "issue_date": datetime.now(timezone.utc).date().isoformat(),
    }


def incoming(client, headers, product, number="200"):
    supplier = client.post(
        "/api/fiscal-suppliers",
        headers=headers,
        json={"name": "Fornecedor fiscal", "document": "12345678000190"},
    )
    assert supplier.status_code == 201, supplier.text
    return {
        "document_type": "entrada",
        "supplier_id": supplier.json()["id"],
        "number": number,
        "issue_date": datetime.now(timezone.utc).date().isoformat(),
        "items": [
            {"product_id": product["id"], "quantity": "3.125", "unit_price": "4.50"}
        ],
    }


def create(client, headers, payload):
    response = client.post(URL, headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def authorization():
    return {
        "status": "Autorizada",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "protocol": "PROTO-AUT-1",
    }


def cancellation():
    return {
        "status": "Cancelada",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "protocol": "PROTO-CANCEL-1",
        "reason": "Cancelamento confirmado externamente",
    }


def patch(client, headers, doc, payload):
    return client.patch(f"{URL}/{doc['id']}", headers=headers, json=payload)


def stock(client, headers, product):
    return Decimal(
        next(
            p["stock_quantity"]
            for p in client.get("/api/products", headers=headers).json()
            if p["id"] == product["id"]
        )
    )


def test_outgoing_snapshots_historical_order_price_and_preserves_inventory(client, db):
    h, customer, product, order = setup_sale(client)
    client.patch(f"/api/products/{product['id']}", headers=h, json={"price": "99.99"})
    before = stock(client, h, product)
    doc = create(client, h, outgoing(order))
    assert doc["order_id"] == order["id"] and doc["customer_id"] == customer["id"]
    assert Decimal(doc["value"]) == Decimal(order["total_amount"]) == Decimal("31.25")
    assert Decimal(doc["items"][0]["unit_price"]) == Decimal("12.50")
    assert doc["items"][0]["fiscal_snapshot"]["fiscal_origin"] == 0
    assert doc["participant_document"] == customer["document"]
    assert doc["created_by_id"] == client.get("/api/auth/me", headers=h).json()["id"]
    assert doc["snapshot_source"] == "order" and not doc["is_legacy"]
    assert (
        len(doc["events"]) == 1 and doc["events"][0]["actor_id"] == doc["created_by_id"]
    )
    assert stock(client, h, product) == before
    # Later master-data edits/deactivation do not rewrite the fiscal snapshot.
    client.patch(
        f"/api/products/{product['id']}",
        headers=h,
        json={"name": "Novo nome", "is_active": False},
    )
    client.patch(
        f"/api/customers/{customer['id']}",
        headers=h,
        json={"name": "Novo cliente", "is_active": False},
    )
    saved = client.get(f"{URL}/{doc['id']}", headers=h).json()
    assert (
        saved["items"][0]["product_name"] == "Café fiscal"
        and saved["participant_name"] == "Cliente fiscal"
    )
    assert (
        client.delete(f"/api/customers/{customer['id']}", headers=h).status_code == 409
    )
    assert client.delete(f"/api/products/{product['id']}", headers=h).status_code == 409


@pytest.mark.parametrize(
    "extra",
    [
        {"value": "0"},
        {"status": "Autorizada"},
        {"organization_id": str(uuid.uuid4())},
        {"is_legacy": True},
        {"created_by_id": str(uuid.uuid4())},
        {"participant_name": "Outra pessoa"},
        {"items": [{"product_id": str(uuid.uuid4()), "quantity": 1, "unit_price": 0}]},
    ],
)
def test_outgoing_rejects_client_owned_authoritative_fields(client, extra):
    h, _, _, order = setup_sale(client)
    assert (
        client.post(URL, headers=h, json={**outgoing(order), **extra}).status_code
        == 422
    )
    assert client.get(URL, headers=h).json() == []


def test_required_links_and_cancelled_orders(client):
    h, _, _, order = setup_sale(client)
    body = outgoing(order)
    body.pop("order_id")
    assert client.post(URL, headers=h, json=body).status_code == 422
    assert (
        client.post(
            URL, headers=h, json={**body, "document_type": "entrada"}
        ).status_code
        == 422
    )
    assert (
        client.patch(
            f"/api/orders/{order['id']}", headers=h, json={"status": "cancelled"}
        ).status_code
        == 200
    )
    assert client.post(URL, headers=h, json=outgoing(order)).status_code == 409


def test_one_active_reissue_preserves_cancelled_and_reserves_number(client):
    h, _, product, order = setup_sale(client)
    first = create(client, h, outgoing(order))
    assert client.post(URL, headers=h, json=outgoing(order, "101")).status_code == 409
    assert client.delete(f"{URL}/{first['id']}", headers=h).status_code == 409
    assert (
        client.patch(
            f"/api/orders/{order['id']}", headers=h, json={"status": "cancelled"}
        ).status_code
        == 409
    )
    cancel = cancellation()
    assert patch(client, h, first, cancel).status_code == 200
    assert patch(client, h, first, cancel).status_code == 200
    assert patch(client, h, first, {"status": "Em processamento"}).status_code == 409
    assert client.post(URL, headers=h, json=outgoing(order)).status_code == 409
    second = create(client, h, outgoing(order, "101"))
    assert second["id"] != first["id"] and second["order_id"] == first["order_id"]
    assert len(client.get(URL, headers=h, params={"order_id": order["id"]}).json()) == 2
    assert client.delete(f"/api/orders/{order['id']}", headers=h).status_code == 409
    assert stock(client, h, product) == Decimal("17.500")
    patch(client, h, second, cancellation())
    assert (
        client.patch(
            f"/api/orders/{order['id']}", headers=h, json={"status": "cancelled"}
        ).status_code
        == 200
    )
    assert stock(client, h, product) == Decimal("20.000")
    assert client.delete(f"/api/orders/{order['id']}", headers=h).status_code == 409


def test_rejected_retry_cannot_collide_with_new_active_document(client):
    h, _, _, order = setup_sale(client)
    doc = create(client, h, outgoing(order))
    assert patch(client, h, doc, {"status": "Rejeitada"}).status_code == 200
    create(client, h, outgoing(order, "101"))
    assert patch(client, h, doc, {"status": "Em processamento"}).status_code == 409


def test_external_evidence_and_event_replay(client):
    h, _, _, order = setup_sale(client)
    doc = create(client, h, outgoing(order))
    assert patch(client, h, doc, {"status": "Autorizada"}).status_code == 422
    auth = authorization()
    assert (
        patch(
            client,
            h,
            doc,
            {
                **auth,
                "occurred_at": (
                    datetime.now(timezone.utc) + timedelta(days=1)
                ).isoformat(),
            },
        ).status_code
        == 422
    )
    assert patch(client, h, doc, auth).status_code == 200
    assert patch(client, h, doc, auth).status_code == 200
    assert patch(client, h, doc, {**auth, "protocol": "DIFFERENT"}).status_code == 409
    assert (
        patch(client, h, doc, {**cancellation(), "protocol": None}).status_code == 422
    )
    assert (
        patch(
            client,
            h,
            doc,
            {
                **cancellation(),
                "occurred_at": (
                    datetime.fromisoformat(auth["occurred_at"]) - timedelta(seconds=1)
                ).isoformat(),
            },
        ).status_code
        == 422
    )
    cancel = cancellation()
    assert patch(client, h, doc, cancel).status_code == 200
    assert patch(client, h, doc, cancel).status_code == 200
    saved = client.get(f"{URL}/{doc['id']}", headers=h).json()
    assert [e["action"] for e in saved["events"]].count("status_changed") == 2
    assert saved["authorization_protocol"] == auth["protocol"] and saved["cancelled_at"]


def test_tenant_scope_member_and_inactive_membership(client, db):
    h, _, _, order = setup_sale(client)
    doc = create(client, h, outgoing(order))
    other = login(client, "empresa-b@gestoria.dev")
    assert client.get(URL, headers=other).json() == []
    assert client.get(f"{URL}/{doc['id']}", headers=other).status_code == 404
    assert patch(client, other, doc, cancellation()).status_code == 404
    assert (
        client.post(URL, headers=other, json=outgoing(order, "101")).status_code == 404
    )
    member = login(client, "membro@gestoria.dev")
    assert client.get(URL, headers=member).status_code == 200
    assert patch(client, member, doc, cancellation()).status_code == 403
    user = db.scalar(select(User).where(User.email == "lucas@gestoria.dev"))
    db.execute(
        update(OrganizationMember)
        .where(OrganizationMember.user_id == user.id)
        .values(is_active=False)
    )
    db.commit()
    assert patch(client, h, doc, cancellation()).status_code == 401


def test_incoming_receipt_and_cancel_are_atomic_and_idempotent(client, db):
    h, _, product, _ = setup_sale(client)
    body = incoming(client, h, product)
    before = stock(client, h, product)
    doc = create(client, h, body)
    assert doc["order_id"] is None and doc["supplier_id"] == body["supplier_id"]
    assert Decimal(doc["value"]) == Decimal("14.06")
    assert stock(client, h, product) == before
    assert client.post(f"{URL}/{doc['id']}/receive", headers=h).status_code == 409
    assert patch(client, h, doc, authorization()).status_code == 200
    for _ in range(2):
        assert client.post(f"{URL}/{doc['id']}/receive", headers=h).status_code == 200
    assert stock(client, h, product) == before + Decimal("3.125")
    cancel = cancellation()
    for _ in range(2):
        assert patch(client, h, doc, cancel).status_code == 200
    assert stock(client, h, product) == before
    assert db.scalar(select(func.count()).select_from(FiscalStockMovement)) == 2
    assert client.post(f"{URL}/{doc['id']}/receive", headers=h).status_code == 409


def test_consumed_entry_cannot_cancel_without_inventory_reconciliation(client, db):
    h, _, product, _ = setup_sale(client)
    doc = create(client, h, incoming(client, h, product))
    patch(client, h, doc, authorization())
    client.post(f"{URL}/{doc['id']}/receive", headers=h)
    client.patch(
        f"/api/products/{product['id']}", headers=h, json={"stock_quantity": "1"}
    )
    assert patch(client, h, doc, cancellation()).status_code == 409
    saved = client.get(f"{URL}/{doc['id']}", headers=h).json()
    assert saved["status"] == "Autorizada" and saved["cancelled_at"] is None
    assert stock(client, h, product) == 1
    assert db.scalar(select(func.count()).select_from(FiscalStockMovement)) == 1


def test_incoming_tenant_duplicate_items_and_inactive_supplier(client):
    h, _, product, _ = setup_sale(client)
    body = incoming(client, h, product)
    assert (
        client.post(
            URL, headers=h, json={**body, "items": body["items"] * 2}
        ).status_code
        == 422
    )
    other = login(client, "empresa-b@gestoria.dev")
    other_product = client.get("/api/products", headers=other).json()[0]
    assert (
        client.post(
            URL,
            headers=h,
            json={
                **body,
                "items": [{**body["items"][0], "product_id": other_product["id"]}],
            },
        ).status_code
        == 404
    )
    assert client.post(URL, headers=other, json=body).status_code == 404
    client.patch(
        f"/api/fiscal-suppliers/{body['supplier_id']}",
        headers=h,
        json={"is_active": False},
    )
    assert client.post(URL, headers=h, json=body).status_code == 404
    assert client.get(URL, headers=h).json() == []


def legacy(db, order, customer, **overrides):
    stored_order = db.get(Order, uuid.UUID(order["id"]))
    values = {
        "organization_id": stored_order.organization_id,
        "document_type": "saida",
        "number": "OLD-1",
        "series": "1",
        "model": "55",
        "participant_name": customer["name"],
        "participant_document": customer["document"],
        "issue_date": date(2025, 1, 1),
        "value": stored_order.total_amount,
        "status": "Autorizada",
        "is_legacy": True,
        "snapshot_source": "legacy_unverified",
    }
    values.update(overrides)
    doc = FiscalDocument(**values)
    db.add(doc)
    db.commit()
    return {"id": str(doc.id)}


def test_legacy_is_preserved_and_requires_explicit_matching_reconciliation(client, db):
    h, customer, _, order = setup_sale(client)
    doc = legacy(db, order, customer)
    assert client.post(URL, headers=h, json=outgoing(order)).status_code == 409
    original = client.get(f"{URL}/{doc['id']}", headers=h).json()
    assert original["created_by_id"] is None and original["authorized_at"] is None
    result = client.post(
        f"{URL}/{doc['id']}/link-order",
        headers=h,
        json={"order_id": order["id"], "reason": "Conferido com documento original"},
    )
    assert result.status_code == 200, result.text
    linked = result.json()
    assert linked["created_by_id"] is None and linked["authorized_at"] is None
    assert (
        linked["issue_date"] == original["issue_date"]
        and linked["value"] == original["value"]
    )
    assert (
        linked["participant_name"] == original["participant_name"]
        and linked["is_legacy"]
    )
    assert (
        linked["order_id"] == order["id"]
        and linked["snapshot_source"] == "reconciled_order"
    )
    assert len(linked["items"]) == 1 and len(linked["events"]) == 1
    assert (
        client.post(
            f"{URL}/{doc['id']}/link-order",
            headers=h,
            json={"order_id": order["id"], "reason": "Conferido novamente no original"},
        ).status_code
        == 200
    )
    assert len(client.get(f"{URL}/{doc['id']}", headers=h).json()["items"]) == 1


@pytest.mark.parametrize(
    "mismatch", [{"value": Decimal(1)}, {"participant_document": "99999999999"}]
)
def test_legacy_mismatch_does_not_invent_links(client, db, mismatch):
    h, customer, _, order = setup_sale(client)
    doc = legacy(db, order, customer, **mismatch)
    response = client.post(
        f"{URL}/{doc['id']}/link-order",
        headers=h,
        json={"order_id": order["id"], "reason": "Conferido com documento original"},
    )
    assert response.status_code == 409
    saved = client.get(f"{URL}/{doc['id']}", headers=h).json()
    assert saved["order_id"] is None and saved["items"] == [] and saved["events"] == []


def test_legacy_incoming_cannot_duplicate_old_inventory(client, db):
    h, customer, _, order = setup_sale(client)
    doc = legacy(db, order, customer, document_type="entrada")
    assert client.post(f"{URL}/{doc['id']}/receive", headers=h).status_code == 409


def test_database_rejects_cross_tenant_links_missing_links_and_deletion(client, db):
    h, _, _, order = setup_sale(client)
    doc = create(client, h, outgoing(order))
    other = login(client, "empresa-b@gestoria.dev")
    other_customer = client.get("/api/customers", headers=other).json()[0]
    for values in (
        {"customer_id": uuid.UUID(other_customer["id"])},
        {"order_id": None},
        {"created_by_id": None},
    ):
        with pytest.raises(IntegrityError):
            db.execute(
                update(FiscalDocument)
                .where(FiscalDocument.id == uuid.UUID(doc["id"]))
                .values(**values)
            )
            db.commit()
        db.rollback()
    with pytest.raises(IntegrityError):
        db.execute(delete(Order).where(Order.id == uuid.UUID(order["id"])))
        db.commit()
    db.rollback()


def test_item_failure_rolls_back_document_and_audit(client, db, monkeypatch):
    from app.services import fiscal

    h, _, _, order = setup_sale(client)

    def fail(*args):
        raise fiscal.FiscalError("Falha de validação simulada")

    monkeypatch.setattr(fiscal, "order_items", fail)
    assert client.post(URL, headers=h, json=outgoing(order)).status_code == 409
    for model in (FiscalDocument, FiscalDocumentItem, FiscalEvent):
        assert db.scalar(select(func.count()).select_from(model)) == 0
