"""Authenticated proposal -> signed confirmation -> atomic order and receipt."""

import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Customer,
    OrderAuditEvent,
    OrderOperation,
    OrganizationMember,
    Product,
    User,
)
from app.operation_crypto import (
    canonical_bytes,
    content_hash,
    parse_keyring,
    seal,
    verify,
)
from app.schemas.order import OrderCreate, OrderItemCreate, OrderRead
from app.services.auth import AuthenticatedUser
from app.services.order_serialization import order_to_read
from app.services.orders import (
    CustomerNotFoundError,
    InsufficientStockError,
    ProductNotFoundError,
    create_order,
)


class OperationError(Exception):
    def __init__(self, code: str, message: str, status: int = 409):
        super().__init__(message)
        self.code, self.status = code, status


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def signing_keys() -> dict[str, bytes]:
    try:
        keys = parse_keyring(settings.operation_signing_keys)
        if settings.operation_active_key_id not in keys:
            raise ValueError()
        return keys
    except ValueError as exc:
        raise OperationError(
            "signing_unavailable", "Configure as chaves de operações no servidor.", 503
        ) from exc


def signed(document: dict, purpose: str) -> dict:
    keys = signing_keys()
    key_id = settings.operation_active_key_id
    return seal(document, key_id, keys[key_id], purpose)


def authorize(db: Session, current: AuthenticatedUser) -> None:
    # Shared locks allow parallel orders, but block revocation until this tx ends.
    user = db.scalar(
        select(User)
        .where(User.id == current.user.id)
        .with_for_update(read=True)
        .execution_options(populate_existing=True)
    )
    member = db.scalar(
        select(OrganizationMember)
        .where(
            OrganizationMember.user_id == current.user.id,
            OrganizationMember.organization_id == current.organization.id,
        )
        .with_for_update(read=True)
        .execution_options(populate_existing=True)
    )
    if (
        not user
        or not user.is_active
        or not member
        or not member.is_active
        or member.role not in {"owner", "admin", "member"}
    ):
        raise OperationError(
            "operation_forbidden", "Você não pode criar pedidos nesta empresa.", 403
        )


def normalized_request(payload: OrderCreate) -> dict:
    quantities: dict[uuid.UUID, Decimal] = {}
    for item in payload.items:
        quantities[item.product_id] = (
            quantities.get(item.product_id, Decimal(0)) + item.quantity
        )
    if any(quantity > Decimal(1000000) for quantity in quantities.values()):
        raise OperationError(
            "quantity_limit", "Quantidade acumulada por produto acima do limite.", 422
        )
    return {
        "customer_id": str(payload.customer_id),
        "items": [
            {"product_id": str(pid), "quantity": format(quantities[pid], ".3f")}
            for pid in sorted(quantities, key=str)
        ],
    }


def build_plan(
    db: Session, organization_id: uuid.UUID, request: dict, *, lock: bool = False
) -> dict:
    query = select(Customer).where(
        Customer.id == uuid.UUID(request["customer_id"]),
        Customer.organization_id == organization_id,
    )
    if lock:
        query = query.with_for_update(read=True)
    customer = db.scalar(query.execution_options(populate_existing=True))
    if not customer or not customer.is_active:
        raise CustomerNotFoundError()
    items, total = [], Decimal(0)
    for item in request["items"]:
        product_id = uuid.UUID(item["product_id"])
        query = select(Product).where(
            Product.id == product_id, Product.organization_id == organization_id
        )
        if lock:
            query = query.with_for_update()
        product = db.scalar(query.execution_options(populate_existing=True))
        if not product or not product.is_active:
            raise ProductNotFoundError(product_id)
        quantity = Decimal(item["quantity"])
        if product.stock_quantity < quantity:
            raise InsufficientStockError(product.name, product.stock_quantity, quantity)
        items.append(
            {
                **item,
                "product_name": product.name,
                "unit_price": format(product.price, ".2f"),
                "unit_of_measure": product.unit_of_measure,
            }
        )
        total += product.price * quantity
    total = total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if total > Decimal("9999999999.99"):
        raise OperationError(
            "total_limit", "Valor do pedido acima do limite suportado.", 422
        )
    return {
        "customer_id": request["customer_id"],
        "customer_name": customer.name,
        "items": items,
        "total_amount": format(total, ".2f"),
    }


def get_operation(
    db: Session, current: AuthenticatedUser, operation_id: uuid.UUID
) -> OrderOperation:
    operation = db.scalar(
        select(OrderOperation)
        .where(
            OrderOperation.id == operation_id,
            OrderOperation.organization_id == current.organization.id,
            OrderOperation.actor_id == current.user.id,
        )
        .execution_options(populate_existing=True)
    )
    if not operation:
        raise OperationError("operation_not_found", "Operação não encontrada.", 404)
    return operation


def check_envelope(operation: OrderOperation, envelope: dict) -> None:
    keys = signing_keys()
    if operation.envelope.get("key_id") not in keys:
        raise OperationError(
            "key_unavailable",
            "Chave histórica indisponível; contate o administrador.",
            503,
        )
    if not verify(envelope, keys, "order-plan"):
        raise OperationError(
            "invalid_signature",
            "A proposta foi alterada ou a assinatura é inválida.",
            403,
        )
    if not hmac.compare_digest(
        canonical_bytes(envelope), canonical_bytes(operation.envelope)
    ):
        raise OperationError(
            "proposal_mismatch",
            "A confirmação não corresponde à proposta registrada.",
            403,
        )
    if (
        envelope.get("operation_id") != str(operation.id)
        or envelope.get("organization_id") != str(operation.organization_id)
        or envelope.get("actor_id") != str(operation.actor_id)
        or envelope.get("idempotency_key") != str(operation.idempotency_key)
        or envelope.get("action") != "create_order"
        or envelope.get("schema_version") != 1
        or envelope.get("input_hash") != content_hash(envelope.get("payload"))
    ):
        raise OperationError(
            "proposal_integrity", "Integridade da proposta comprometida."
        )


def append_event(
    db: Session,
    operation: OrderOperation,
    event_type: str,
    *,
    reason: str | None = None,
) -> None:
    event_id = uuid.uuid4()
    document = signed(
        {
            "event_id": str(event_id),
            "operation_id": str(operation.id),
            "organization_id": str(operation.organization_id),
            "actor_id": str(operation.actor_id),
            "event_type": event_type,
            "reason": reason,
            "recorded_at": utc_now().isoformat(),
            "input_hash": operation.envelope.get("input_hash"),
            "output_hash": operation.receipt.get("output_hash")
            if operation.receipt
            else None,
        },
        "order-audit",
    )
    db.add(
        OrderAuditEvent(
            id=event_id,
            organization_id=operation.organization_id,
            actor_id=operation.actor_id,
            operation_id=operation.id,
            event_type=event_type,
            document=document,
        )
    )
    db.flush()


def prepare_order(
    db: Session,
    current: AuthenticatedUser,
    payload: OrderCreate,
    idempotency_key: uuid.UUID,
) -> OrderOperation:
    authorize(db, current)
    signing_keys()
    request = normalized_request(payload)
    request_hash = content_hash(request)

    def existing():
        return db.scalar(
            select(OrderOperation)
            .where(
                OrderOperation.organization_id == current.organization.id,
                OrderOperation.actor_id == current.user.id,
                OrderOperation.idempotency_key == idempotency_key,
            )
            .execution_options(populate_existing=True)
        )

    def reuse(operation):
        if not hmac.compare_digest(operation.request_hash, request_hash):
            raise OperationError(
                "idempotency_conflict",
                "Este identificador já foi usado com outros dados.",
            )
        check_envelope(operation, operation.envelope)
        return operation

    operation = existing()
    if operation:
        return reuse(operation)
    plan = build_plan(db, current.organization.id, request)
    operation_id, now = uuid.uuid4(), utc_now()
    envelope = signed(
        {
            "schema_version": 1,
            "action": "create_order",
            "operation_id": str(operation_id),
            "organization_id": str(current.organization.id),
            "actor_id": str(current.user.id),
            "idempotency_key": str(idempotency_key),
            "nonce": secrets.token_hex(16),
            "issued_at": now.isoformat(),
            "expires_at": (
                now + timedelta(seconds=settings.operation_ttl_seconds)
            ).isoformat(),
            "payload": plan,
            "input_hash": content_hash(plan),
        },
        "order-plan",
    )
    dialect = db.get_bind().dialect.name
    if dialect not in {"postgresql", "sqlite"}:
        raise OperationError(
            "unsupported_database",
            "Banco não suportado para operações protegidas.",
            503,
        )
    insert = pg_insert if dialect == "postgresql" else sqlite_insert
    inserted = db.scalar(
        insert(OrderOperation)
        .values(
            id=operation_id,
            organization_id=current.organization.id,
            actor_id=current.user.id,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            status="pending",
            envelope=envelope,
        )
        .on_conflict_do_nothing(
            index_elements=["organization_id", "actor_id", "idempotency_key"]
        )
        .returning(OrderOperation.id)
    )
    if inserted is None:
        operation = existing()
        if not operation:
            raise OperationError(
                "preparation_conflict",
                "Não foi possível recuperar a proposta concorrente.",
            )
        return reuse(operation)
    operation = get_operation(db, current, operation_id)
    append_event(db, operation, "prepared")
    db.commit()
    return operation


def verified_receipt(operation: OrderOperation) -> dict:
    receipt = operation.receipt
    keys = signing_keys()
    if receipt and receipt.get("key_id") not in keys:
        raise OperationError(
            "key_unavailable",
            "Chave histórica indisponível; contate o administrador.",
            503,
        )
    if (
        not receipt
        or not verify(receipt, keys, "order-receipt")
        or receipt.get("operation_id") != str(operation.id)
        or receipt.get("organization_id") != str(operation.organization_id)
        or receipt.get("actor_id") != str(operation.actor_id)
        or receipt.get("input_hash") != operation.envelope.get("input_hash")
        or receipt.get("output_hash") != content_hash(receipt.get("result"))
    ):
        raise OperationError(
            "receipt_integrity", "Comprovante ausente ou com integridade comprometida."
        )
    return receipt


def confirm_order(
    db: Session, current: AuthenticatedUser, operation_id: uuid.UUID, envelope: dict
) -> tuple[OrderRead, bool]:
    authorize(db, current)
    operation = get_operation(db, current, operation_id)
    check_envelope(operation, envelope)
    # A successful retry returns the historical result, including after expiry.
    if operation.receipt is not None or operation.status == "executed":
        return OrderRead.model_validate(verified_receipt(operation)["result"]), True
    if operation.status == "cancelled":
        raise OperationError(
            "proposal_cancelled",
            "A proposta foi descartada. Revise uma nova proposta.",
            410,
        )
    if datetime.fromisoformat(envelope["expires_at"]) <= utc_now():
        raise OperationError(
            "proposal_expired", "A proposta expirou. Revise uma nova proposta.", 410
        )

    # Compare-and-set in the SAME transaction as stock, order, receipt and audit.
    # PostgreSQL waits for a competing UPDATE, then re-evaluates this predicate.
    claimed = db.scalar(
        update(OrderOperation)
        .where(
            OrderOperation.id == operation.id,
            OrderOperation.status == "pending",
            OrderOperation.receipt.is_(None),
        )
        .values(status="processing")
        .returning(OrderOperation.id)
        .execution_options(synchronize_session=False)
    )
    if claimed is None:
        operation = get_operation(db, current, operation_id)
        if operation.receipt is not None:
            return OrderRead.model_validate(verified_receipt(operation)["result"]), True
        raise OperationError(
            "operation_in_progress",
            "Operação em andamento. Tente novamente com a mesma proposta.",
        )
    operation.status = "processing"
    # Check time again after a potentially blocking lock acquisition.
    if datetime.fromisoformat(envelope["expires_at"]) <= utc_now():
        raise OperationError(
            "proposal_expired", "A proposta expirou. Revise uma nova proposta.", 410
        )
    plan = envelope["payload"]
    request = {
        "customer_id": plan["customer_id"],
        "items": [
            {"product_id": item["product_id"], "quantity": item["quantity"]}
            for item in plan["items"]
        ],
    }
    current_plan = build_plan(db, current.organization.id, request, lock=True)
    if content_hash(current_plan) != envelope["input_hash"]:
        raise OperationError(
            "proposal_stale",
            "Cliente, produto ou preço mudou. Revise uma nova proposta.",
        )
    order = create_order(
        db,
        current.organization.id,
        uuid.UUID(plan["customer_id"]),
        [OrderItemCreate.model_validate(item) for item in request["items"]],
        commit=False,
    )
    result = order_to_read(order)
    if result.total_amount != Decimal(plan["total_amount"]):
        raise OperationError(
            "persisted_result_mismatch",
            "O resultado divergiu do valor aprovado; nenhuma alteração foi confirmada.",
        )
    snapshot = result.model_dump(mode="json")
    operation.status = "executed"
    operation.receipt = signed(
        {
            "schema_version": 1,
            "action": "create_order",
            "operation_id": str(operation.id),
            "organization_id": str(operation.organization_id),
            "actor_id": str(operation.actor_id),
            "input_hash": envelope["input_hash"],
            "output_hash": content_hash(snapshot),
            "executed_at": utc_now().isoformat(),
            "result": snapshot,
        },
        "order-receipt",
    )
    append_event(db, operation, "executed")
    db.commit()
    return result, False


def record_rejection(
    db: Session, current: AuthenticatedUser, operation_id: uuid.UUID, code: str
) -> None:
    # Failed business work was rolled back first. Never log attacker payloads.
    operation = db.scalar(
        select(OrderOperation).where(
            OrderOperation.id == operation_id,
            OrderOperation.organization_id == current.organization.id,
            OrderOperation.actor_id == current.user.id,
        )
    )
    if operation:
        append_event(db, operation, "rejected", reason=code)
        db.commit()


def cancel_order(
    db: Session, current: AuthenticatedUser, operation_id: uuid.UUID
) -> None:
    authorize(db, current)
    operation = get_operation(db, current, operation_id)
    check_envelope(operation, operation.envelope)
    if operation.status == "cancelled":
        return
    claimed = db.scalar(
        update(OrderOperation)
        .where(
            OrderOperation.id == operation_id,
            OrderOperation.status == "pending",
            OrderOperation.receipt.is_(None),
        )
        .values(status="cancelled")
        .returning(OrderOperation.id)
        .execution_options(synchronize_session=False)
    )
    if claimed is None:
        raise OperationError(
            "already_executed",
            "A operação já foi executada ou está em andamento. Consulte o comprovante.",
        )
    operation.status = "cancelled"
    append_event(db, operation, "cancelled")
    db.commit()
