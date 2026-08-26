import uuid

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUser, DatabaseSession
from app.repositories import (
    CustomerRepository,
    OrderItemRepository,
    OrderRepository,
    ProductRepository,
)

from app.schemas import OrderCreate, OrderItemRead, OrderRead, OrderStatusUpdate
from app.services import (
    CustomerNotFoundError,
    InsufficientStockError,
    ProductNotFoundError,
    create_order,
    update_order_status,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])

def order_not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Pedido não encontrado.")

def require_role(current: CurrentUser, allowed: set[str]) -> None: 
    if current.membership.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não possui permissão para executar essa ação.",
        )

def _build_order_read(db: Session, organization_id: uuid.UUID, order) -> OrderRead:
    customer = CustomerRepository.get_for_organization(db, order.customer_id, organization_id)
    items = OrderItemRepository.list_for_order(db, order.id)

    item_reads = []
    for item in items:
        product = ProductRepository.get_for_organization(db, item.product_id, organization_id)
        item_reads.append(OrderItemRead(
            id=item.id,
            product_id=item.product_id,
            product_name=product.name if product else "Produto Removido.",
            quantity=item.quantity,
            unit_price=item.unit_price,
        ))

    return OrderRead(
        id=order.id,
        organization_id=order.organization_id,
        customer_id=order.customer_id,
        customer_name=customer.name if customer else "Cliente Removido.",
        status = order.status,
        total_amount=order.total_amount,
        items=item_reads,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )

@router.get("", response_model=list[OrderRead])
def list_orders(db: DatabaseSession, current: CurrentUser) -> list[OrderRead]:
    orders = OrderRepository.list_for_organization(db, current.organization.id)
    return [_build_order_read(db, current.organization.id, o) for o in orders]

@router.post ("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order_route(
    payload:OrderCreate, db: DatabaseSession, current: CurrentUser
) -> OrderRead:
    try:
        order = create_order(db, current.organization.id, payload.customer_id, payload.items)
    except CustomerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except InsufficientStockError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return _build_order_read(db, current.organization.id, order)

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

    order = update_order_status(db, order_id, current.organization.id)
    return _build_order_read(db, current.organization.id, order)

@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: uuid.UUID, db: DatabaseSession, current: CurrentUser
) -> Response:
    require_role(current, {"owner", "admin"})

    order = OrderRepository.get_for_organization(db, order_id, current.organization.id)
    if not order:
        raise order_not_found()

    OrderRepository.delete(db, order)
    return Response(status_code=status.HTTP_204_NO_CONTENT)