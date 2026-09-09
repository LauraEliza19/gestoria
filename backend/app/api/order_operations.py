import uuid
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, Response
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DatabaseSession
from app.models import OrderAuditEvent
from app.operation_crypto import verify
from app.schemas.order import OrderCreate, OrderRead
from app.schemas.order_operation import (
    OrderConfirmation,
    OrderProposalRead,
    OrderReceiptRead,
)
from app.services import (
    CustomerNotFoundError,
    InsufficientStockError,
    ProductNotFoundError,
)
from app.services import order_operations as operations

router = APIRouter(prefix="/api/orders", tags=["protected orders"])


def http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, operations.OperationError):
        return HTTPException(
            exc.status, detail=str(exc), headers={"X-Error-Code": exc.code}
        )
    if isinstance(exc, InsufficientStockError):
        return HTTPException(
            409, detail=str(exc), headers={"X-Error-Code": "insufficient_stock"}
        )
    return HTTPException(
        404, detail=str(exc), headers={"X-Error-Code": "resource_not_found"}
    )


DOMAIN_ERRORS = (
    operations.OperationError,
    CustomerNotFoundError,
    ProductNotFoundError,
    InsufficientStockError,
)


@router.post("/proposals", response_model=OrderProposalRead, status_code=201)
def prepare_order(
    payload: OrderCreate,
    db: DatabaseSession,
    current: CurrentUser,
    response: Response,
    idempotency_key: Annotated[uuid.UUID, Header(alias="Idempotency-Key")],
):
    response.headers["Cache-Control"] = "no-store"
    try:
        operation = operations.prepare_order(db, current, payload, idempotency_key)
        return OrderProposalRead(
            operation_id=str(operation.id),
            status=operation.status,
            envelope=operation.envelope,
        )
    except DOMAIN_ERRORS as exc:
        db.rollback()
        raise http_error(exc) from exc


@router.get("/proposals/{operation_id}", response_model=OrderProposalRead)
def get_proposal(
    operation_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
    response: Response,
):
    response.headers["Cache-Control"] = "no-store"
    try:
        operation = operations.get_operation(db, current, operation_id)
        operations.check_envelope(operation, operation.envelope)
        return OrderProposalRead(
            operation_id=str(operation.id),
            status=operation.status,
            envelope=operation.envelope,
        )
    except operations.OperationError as exc:
        raise http_error(exc) from exc


@router.post(
    "/proposals/{operation_id}/confirm", response_model=OrderRead, status_code=201
)
def confirm_order(
    operation_id: uuid.UUID,
    payload: OrderConfirmation,
    db: DatabaseSession,
    current: CurrentUser,
    response: Response,
):
    response.headers["Cache-Control"] = "no-store"
    try:
        order, replayed = operations.confirm_order(
            db, current, operation_id, payload.envelope
        )
        response.status_code = 200 if replayed else 201
        response.headers["X-Operation-ID"] = str(operation_id)
        response.headers["X-Idempotent-Replay"] = "true" if replayed else "false"
        return order
    except DOMAIN_ERRORS as exc:
        db.rollback()
        error = http_error(exc)
        # A missing key cannot be used to sign an audit event. No fallback key.
        if error.status_code != 503:
            operations.record_rejection(
                db, current, operation_id, error.headers["X-Error-Code"]
            )
        raise error from exc
    except Exception:
        db.rollback()
        raise


@router.get("/proposals/{operation_id}/receipt", response_model=OrderReceiptRead)
def get_receipt(
    operation_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
    response: Response,
):
    response.headers["Cache-Control"] = "no-store"
    try:
        operation = operations.get_operation(db, current, operation_id)
        operations.check_envelope(operation, operation.envelope)
        if operation.receipt is None and operation.status != "executed":
            raise operations.OperationError(
                "not_executed", "A operação ainda não foi executada."
            )
        return OrderReceiptRead(
            verified=True, receipt=operations.verified_receipt(operation)
        )
    except operations.OperationError as exc:
        raise http_error(exc) from exc


@router.post("/proposals/{operation_id}/cancel", status_code=204)
def cancel_proposal(operation_id: uuid.UUID, db: DatabaseSession, current: CurrentUser):
    try:
        operations.cancel_order(db, current, operation_id)
        return Response(status_code=204, headers={"Cache-Control": "no-store"})
    except operations.OperationError as exc:
        db.rollback()
        raise http_error(exc) from exc


@router.get("/security/events")
def list_events(
    db: DatabaseSession,
    current: CurrentUser,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
):
    response.headers["Cache-Control"] = "no-store"
    query = select(OrderAuditEvent).where(
        OrderAuditEvent.organization_id == current.organization.id
    )
    if current.membership.role not in {"owner", "admin"}:
        query = query.where(OrderAuditEvent.actor_id == current.user.id)
    try:
        keys = operations.signing_keys()
    except operations.OperationError as exc:
        raise http_error(exc) from exc
    events = db.scalars(
        query.order_by(
            OrderAuditEvent.created_at.desc(), OrderAuditEvent.id.desc()
        ).limit(limit)
    )
    result = []
    for event in events:
        document = event.document
        valid = (
            verify(document, keys, "order-audit")
            and document.get("organization_id") == str(event.organization_id)
            and document.get("actor_id") == str(event.actor_id)
            and document.get("operation_id") == str(event.operation_id)
            and document.get("event_id") == str(event.id)
            and document.get("event_type") == event.event_type
        )
        result.append(
            {
                "id": str(event.id),
                "operation_id": str(event.operation_id),
                "event_type": event.event_type,
                "verified": valid,
                "document": document if valid else None,
            }
        )
    return result
