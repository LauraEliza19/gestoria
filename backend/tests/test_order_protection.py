import copy
import json
import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from test_api import login

from app.config import settings
from app.models import (
    Order,
    OrderAuditEvent,
    OrderOperation,
    OrganizationMember,
    Product,
)
from app.operation_crypto import content_hash, seal, verify
from app.services import order_operations as operations


@pytest.fixture
def prepared(client):
    headers = login(client)
    customer = client.post(
        "/api/customers",
        headers=headers,
        json={"name": "Cliente segurança", "phone": "35912345678"},
    ).json()
    product = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": "Produto segurança",
            "price": "12.50",
            "stock_quantity": "10.000",
        },
    ).json()
    body = {
        "customer_id": customer["id"],
        "items": [{"product_id": product["id"], "quantity": "2.000"}],
    }
    key = str(uuid.uuid4())
    response = client.post(
        "/api/orders/proposals", headers={**headers, "Idempotency-Key": key}, json=body
    )
    assert response.status_code == 201, response.text
    return headers, body, key, response.json()


def confirm(client, prepared, envelope=None):
    headers, _, _, proposal = prepared
    return client.post(
        f"/api/orders/proposals/{proposal['operation_id']}/confirm",
        headers=headers,
        json={"envelope": envelope if envelope is not None else proposal["envelope"]},
    )


def test_preparation_does_not_write_order_or_change_stock(client, prepared):
    headers, _, _, proposal = prepared
    assert client.get("/api/orders", headers=headers).json() == []
    assert (
        Decimal(
            client.get("/api/products", headers=headers).json()[0]["stock_quantity"]
        )
        == 10
    )
    assert proposal["envelope"]["payload"]["total_amount"] == "25.00"


def test_confirmation_receipt_and_retry_are_consistent(client, prepared):
    headers, _, _, proposal = prepared
    first, retry = confirm(client, prepared), confirm(client, prepared)
    assert first.status_code == 201, first.text
    assert retry.status_code == 200, retry.text
    assert first.json() == retry.json()
    assert retry.headers["X-Idempotent-Replay"] == "true"
    assert (
        Decimal(
            client.get("/api/products", headers=headers).json()[0]["stock_quantity"]
        )
        == 8
    )
    receipt = client.get(
        f"/api/orders/proposals/{proposal['operation_id']}/receipt", headers=headers
    ).json()
    assert receipt["verified"] is True
    assert receipt["receipt"]["result"] == first.json()
    assert receipt["receipt"]["output_hash"] == content_hash(first.json())
    assert receipt["receipt"]["input_hash"] == proposal["envelope"]["input_hash"]
    events = client.get("/api/orders/security/events", headers=headers).json()
    assert sorted(e["event_type"] for e in events) == ["executed", "prepared"]
    assert all(e["verified"] for e in events)


@pytest.mark.parametrize(
    "field",
    [
        "quantity",
        "unit_price",
        "customer_id",
        "organization_id",
        "actor_id",
        "expires_at",
        "nonce",
        "action",
        "signature",
        "algorithm",
        "key_id",
        "input_hash",
    ],
)
def test_tampering_is_rejected_even_if_attacker_recalculates_hash(
    client, prepared, field
):
    envelope = copy.deepcopy(prepared[3]["envelope"])
    if field in {"quantity", "unit_price"}:
        envelope["payload"]["items"][0][field] = (
            "99.000" if field == "quantity" else "0.01"
        )
    elif field == "customer_id":
        envelope["payload"][field] = str(uuid.uuid4())
    else:
        envelope[field] = "alterado"
    if field != "input_hash":
        envelope["input_hash"] = content_hash(envelope["payload"])
    response = confirm(client, prepared, envelope)
    assert response.status_code == 403, response.text
    headers = prepared[0]
    assert client.get("/api/orders", headers=headers).json() == []
    assert (
        Decimal(
            client.get("/api/products", headers=headers).json()[0]["stock_quantity"]
        )
        == 10
    )
    events = client.get("/api/orders/security/events", headers=headers).json()
    assert any(e["event_type"] == "rejected" and e["verified"] for e in events)


def test_object_key_order_does_not_invalidate_signed_content(client, prepared):
    envelope = dict(reversed(list(prepared[3]["envelope"].items())))
    assert confirm(client, prepared, envelope).status_code == 201


def test_same_key_reuses_proposal_and_changed_body_conflicts(client, prepared):
    headers, body, key, proposal = prepared
    response = client.post(
        "/api/orders/proposals", headers={**headers, "Idempotency-Key": key}, json=body
    )
    assert response.json() == proposal
    changed = copy.deepcopy(body)
    changed["items"][0]["quantity"] = "3.000"
    response = client.post(
        "/api/orders/proposals",
        headers={**headers, "Idempotency-Key": key},
        json=changed,
    )
    assert response.status_code == 409
    assert response.headers["X-Error-Code"] == "idempotency_conflict"


def test_old_direct_creation_is_closed(client, prepared):
    response = client.post("/api/orders", headers=prepared[0], json=prepared[1])
    assert response.status_code == 428
    assert client.get("/api/orders", headers=prepared[0]).json() == []


@pytest.mark.parametrize("email", ["membro@gestoria.dev", "empresa-b@gestoria.dev"])
def test_other_actor_or_tenant_cannot_read_confirm_cancel_or_get_receipt(
    client, prepared, email
):
    headers = login(client, email)
    operation_id = prepared[3]["operation_id"]
    path = f"/api/orders/proposals/{operation_id}"
    assert client.get(path, headers=headers).status_code == 404
    assert (
        client.post(
            path + "/confirm",
            headers=headers,
            json={"envelope": prepared[3]["envelope"]},
        ).status_code
        == 404
    )
    assert client.post(path + "/cancel", headers=headers).status_code == 404
    assert client.get(path + "/receipt", headers=headers).status_code == 404
    assert client.get("/api/orders/security/events", headers=headers).json() == []


def test_expiration_and_successful_retry_after_expiration(
    client, prepared, monkeypatch
):
    now = operations.utc_now()
    monkeypatch.setattr(operations, "utc_now", lambda: now + timedelta(hours=1))
    assert confirm(client, prepared).status_code == 410
    monkeypatch.setattr(operations, "utc_now", lambda: now)
    result = confirm(client, prepared)
    assert result.status_code == 201
    monkeypatch.setattr(operations, "utc_now", lambda: now + timedelta(hours=1))
    retry = confirm(client, prepared)
    assert retry.status_code == 200
    assert retry.json() == result.json()


def test_changed_price_requires_new_review(client, prepared):
    headers, body, _, _ = prepared
    pid = body["items"][0]["product_id"]
    assert (
        client.patch(
            f"/api/products/{pid}", headers=headers, json={"price": "99.90"}
        ).status_code
        == 200
    )
    response = confirm(client, prepared)
    assert response.status_code == 409
    assert response.headers["X-Error-Code"] == "proposal_stale"
    assert client.get("/api/orders", headers=headers).json() == []


def test_insufficient_stock_is_rechecked_at_execution(client, prepared):
    headers, body, _, _ = prepared
    pid = body["items"][0]["product_id"]
    client.patch(
        f"/api/products/{pid}", headers=headers, json={"stock_quantity": "1.000"}
    )
    assert confirm(client, prepared).status_code == 409
    assert client.get("/api/orders", headers=headers).json() == []


def test_membership_revocation_blocks_confirmation(client, prepared, db):
    actor = uuid.UUID(prepared[3]["envelope"]["actor_id"])
    member = db.scalar(
        select(OrganizationMember).where(OrganizationMember.user_id == actor)
    )
    member.is_active = False
    db.commit()
    assert confirm(client, prepared).status_code == 401
    assert db.scalar(select(func.count()).select_from(Order)) == 0


def test_audit_write_failure_rolls_back_order_stock_and_operation(
    client, prepared, db, monkeypatch
):
    def unavailable(*args, **kwargs):
        raise RuntimeError("auditoria indisponível")

    monkeypatch.setattr(operations, "append_event", unavailable)
    with pytest.raises(RuntimeError, match="auditoria indisponível"):
        confirm(client, prepared)
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Order)) == 0
    product = db.get(Product, uuid.UUID(prepared[1]["items"][0]["product_id"]))
    assert product.stock_quantity == 10
    operation = db.get(OrderOperation, uuid.UUID(prepared[3]["operation_id"]))
    assert operation.status == "pending" and operation.receipt is None


def test_receipt_tamper_detected_and_deleted_order_not_recreated(client, prepared, db):
    headers, _, _, proposal = prepared
    result = confirm(client, prepared)
    assert result.status_code == 201
    assert (
        client.delete(f"/api/orders/{result.json()['id']}", headers=headers).status_code
        == 204
    )
    assert confirm(client, prepared).json() == result.json()
    assert client.get("/api/orders", headers=headers).json() == []
    operation = db.get(OrderOperation, uuid.UUID(proposal["operation_id"]))
    receipt = copy.deepcopy(operation.receipt)
    receipt["result"]["total_amount"] = "0.01"
    receipt["output_hash"] = content_hash(receipt["result"])
    operation.receipt = receipt
    db.commit()
    response = client.get(
        f"/api/orders/proposals/{proposal['operation_id']}/receipt", headers=headers
    )
    assert response.status_code == 409


def test_audit_tamper_is_flagged_without_returning_untrusted_document(
    client, prepared, db
):
    event = db.scalar(select(OrderAuditEvent))
    event.document = {**event.document, "event_type": "executed"}
    db.commit()
    events = client.get("/api/orders/security/events", headers=prepared[0]).json()
    assert events[0]["verified"] is False
    assert events[0]["document"] is None


def test_key_rotation_accepts_old_proposal_and_signs_receipt_with_new_key(
    client, prepared, monkeypatch
):
    monkeypatch.setattr(
        settings,
        "operation_signing_keys",
        json.dumps({"test": "ab" * 32, "v2": "cd" * 32}),
    )
    monkeypatch.setattr(settings, "operation_active_key_id", "v2")
    assert confirm(client, prepared).status_code == 201
    receipt = client.get(
        f"/api/orders/proposals/{prepared[3]['operation_id']}/receipt",
        headers=prepared[0],
    ).json()
    assert receipt["receipt"]["key_id"] == "v2"
    monkeypatch.setattr(
        settings, "operation_signing_keys", json.dumps({"v2": "cd" * 32})
    )
    assert confirm(client, prepared).status_code == 503


def test_no_key_fails_closed(client, prepared, monkeypatch):
    monkeypatch.setattr(settings, "operation_signing_keys", "")
    assert confirm(client, prepared).status_code == 503
    assert client.get("/api/orders", headers=prepared[0]).json() == []


def test_cancel_is_idempotent_and_blocks_execution(client, prepared):
    path = f"/api/orders/proposals/{prepared[3]['operation_id']}/cancel"
    assert client.post(path, headers=prepared[0]).status_code == 204
    assert client.post(path, headers=prepared[0]).status_code == 204
    assert confirm(client, prepared).status_code == 410


def test_decimal_quantities_match_plan_and_persisted_result(client, prepared):
    headers, body, _, _ = prepared
    body = copy.deepcopy(body)
    body["items"][0]["quantity"] = "1.235"
    proposal = client.post(
        "/api/orders/proposals",
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        json=body,
    ).json()
    result = client.post(
        f"/api/orders/proposals/{proposal['operation_id']}/confirm",
        headers=headers,
        json={"envelope": proposal["envelope"]},
    )
    assert result.status_code == 201, result.text
    assert (
        result.json()["total_amount"] == proposal["envelope"]["payload"]["total_amount"]
    )
    assert Decimal(result.json()["items"][0]["quantity"]) == Decimal("1.235")


def test_unknown_fields_and_oversized_item_list_are_rejected(client, prepared):
    headers, body, _, _ = prepared
    for changed in [
        {**body, "organization_id": str(uuid.uuid4())},
        {**body, "items": body["items"] * 101},
    ]:
        result = client.post(
            "/api/orders/proposals",
            headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
            json=changed,
        )
        assert result.status_code == 422


def test_crypto_uses_domain_separation():
    key = bytes.fromhex("ef" * 32)
    document = seal({"amount": "1.00"}, "test", key, "order-plan")
    assert verify(document, {"test": key}, "order-plan")
    assert not verify(document, {"test": key}, "order-receipt")
    assert not verify({**document, "extra": "field"}, {"test": key}, "order-plan")


def test_half_cent_rounding_matches_approved_total(client, prepared):
    headers, body, _, _ = prepared
    pid = body["items"][0]["product_id"]
    client.patch(f"/api/products/{pid}", headers=headers, json={"price": "0.01"})
    body = copy.deepcopy(body)
    body["items"][0]["quantity"] = "0.500"
    proposal = client.post(
        "/api/orders/proposals",
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        json=body,
    ).json()
    result = client.post(
        f"/api/orders/proposals/{proposal['operation_id']}/confirm",
        headers=headers,
        json={"envelope": proposal["envelope"]},
    )
    assert result.status_code == 201, result.text
    assert (
        result.json()["total_amount"]
        == proposal["envelope"]["payload"]["total_amount"]
        == "0.01"
    )


def test_preparation_requires_authentication_and_idempotency_key(client, prepared):
    assert (
        client.post(
            "/api/orders/proposals",
            headers={"Idempotency-Key": str(uuid.uuid4())},
            json=prepared[1],
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/orders/proposals", headers=prepared[0], json=prepared[1]
        ).status_code
        == 422
    )


def test_proposal_row_tamper_is_detected(client, prepared, db):
    operation = db.get(OrderOperation, uuid.UUID(prepared[3]["operation_id"]))
    changed = copy.deepcopy(operation.envelope)
    changed["payload"]["total_amount"] = "0.01"
    operation.envelope = changed
    db.commit()
    assert confirm(client, prepared).status_code == 403
    assert db.scalar(select(func.count()).select_from(Order)) == 0


def test_preparation_audit_failure_does_not_leave_orphan_proposal(
    client, prepared, db, monkeypatch
):
    before = db.scalar(select(func.count()).select_from(OrderOperation))

    def unavailable(*args, **kwargs):
        raise RuntimeError("auditoria indisponível")

    monkeypatch.setattr(operations, "append_event", unavailable)
    with pytest.raises(RuntimeError, match="auditoria indisponível"):
        client.post(
            "/api/orders/proposals",
            headers={**prepared[0], "Idempotency-Key": str(uuid.uuid4())},
            json=prepared[1],
        )
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(OrderOperation)) == before
