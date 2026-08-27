import uuid

from fastapi import APIRouter, HTTPException, Response, status

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import OrderRepository
from app.schemas import OrderCreate, OrderItemRead, OrderRead, OrderStatusUpdate
from app.services import (
    CustomerNotFoundError,
    InsufficientStockError,
    ProductNotFoundError,
    create_order,
    delete_order_record,
    update_order_status,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])


def order_not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Pedido não encontrado.")


def _build_order_read(order) -> OrderRead:
    item_reads = [
        OrderItemRead(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name if item.product else "Produto removido",
            quantity=item.quantity,
            unit_price=item.unit_price,
        )
        for item in order.items
    ]

    return OrderRead(
        id=order.id,
        organization_id=order.organization_id,
        customer_id=order.customer_id,
        customer_name=order.customer.name if order.customer else "Cliente removido",
        status=order.status,
        total_amount=order.total_amount,
        items=item_reads,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.get("", response_model=list[OrderRead])
def list_orders(db: DatabaseSession, current: CurrentUser) -> list[OrderRead]:
    orders = OrderRepository.list_for_organization(db, current.organization.id)
    return [_build_order_read(order) for order in orders]


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order_route(
    payload: OrderCreate, db: DatabaseSession, current: CurrentUser
) -> OrderRead:
    try:
        order = create_order(
            db, current.organization.id, payload.customer_id, payload.items
        )
    except CustomerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except InsufficientStockError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return _build_order_read(order)


@router.patch("/{order_id}", response_model=OrderRead)
def update_status_route(
    order_id: uuid.UUID,
    payload: OrderStatusUpdate,
    db: DatabaseSession,
    current: CurrentUser,
) -> OrderRead:
    order = OrderRepository.get_for_organization(db, order_id, current.organization.id)
    if not order:
        raise order_not_found()

    try:
        order = update_order_status(db, order, payload.status)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except InsufficientStockError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return _build_order_read(order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order_route(
    order_id: uuid.UUID, db: DatabaseSession, current: CurrentUser
) -> Response:
    require_role(current, {"owner", "admin"})

    order = OrderRepository.get_for_organization(db, order_id, current.organization.id)
    if not order:
        raise order_not_found()

    delete_order_record(db, order)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
