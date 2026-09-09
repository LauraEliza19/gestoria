import uuid

from fastapi import APIRouter, HTTPException, Response, status

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import OrderRepository
from app.schemas import OrderCreate, OrderRead, OrderStatusUpdate
from app.services import (
    InsufficientStockError,
    OrderStatusTransitionError,
    ProductNotFoundError,
    delete_order_record,
    update_order_status,
)
from app.services.order_serialization import order_to_read as _build_order_read

router = APIRouter(prefix="/api/orders", tags=["orders"])


def order_not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Pedido não encontrado.")


@router.get("", response_model=list[OrderRead])
def list_orders(db: DatabaseSession, current: CurrentUser) -> list[OrderRead]:
    orders = OrderRepository.list_for_organization(db, current.organization.id)
    return [_build_order_read(order) for order in orders]


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order_route(
    payload: OrderCreate, db: DatabaseSession, current: CurrentUser
) -> OrderRead:
    raise HTTPException(
        status_code=428,
        detail="Crie uma proposta em /api/orders/proposals e confirme os dados para registrar o pedido.",
        headers={"X-Error-Code": "confirmation_required"},
    )


@router.patch("/{order_id}", response_model=OrderRead)
def update_status_route(
    order_id: uuid.UUID,
    payload: OrderStatusUpdate,
    db: DatabaseSession,
    current: CurrentUser,
) -> OrderRead:
    order = OrderRepository.get_for_organization(
        db,
        order_id,
        current.organization.id,
        for_update=True,
    )
    if not order:
        raise order_not_found()

    try:
        order = update_order_status(db, order, payload.status)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except (InsufficientStockError, OrderStatusTransitionError) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return _build_order_read(order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order_route(
    order_id: uuid.UUID, db: DatabaseSession, current: CurrentUser
) -> Response:
    require_role(current, {"owner", "admin"})

    order = OrderRepository.get_for_organization(
        db,
        order_id,
        current.organization.id,
        for_update=True,
    )
    if not order:
        raise order_not_found()

    delete_order_record(db, order)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
