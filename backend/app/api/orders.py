import uuid

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import OrderRepository
from app.schemas import OrderCreate, OrderRead, OrderStatusUpdate, PaginatedResponse
from app.services import (
    InsufficientStockError,
    OrderStatusTransitionError,
    ProductNotFoundError,
    delete_order_record,
    update_order_status,
)
from app.services.order_serialization import order_to_read as _build_order_read
from app.services.orders import OrderFiscalConflictError

router = APIRouter(prefix="/api/orders", tags=["orders"])


def order_not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Pedido não encontrado.")


@router.get("", response_model=PaginatedResponse[OrderRead])
def list_orders(
    db: DatabaseSession,
    current: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    status_filter: str | None = Query(
        default=None, alias="status", pattern="^(in_preparation|completed|cancelled)$"
    ),
    sort: str = Query(default="created_at", pattern="^(created_at|total_amount)$"),
) -> PaginatedResponse[OrderRead]:
    result = OrderRepository.list_for_organization(
        db,
        current.organization.id,
        page=page,
        page_size=page_size,
        search=search,
        status=status_filter,
        sort=sort,
    )
    result["items"] = [_build_order_read(order) for order in result["items"]]
    return result


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
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc
    except (
        InsufficientStockError,
        OrderStatusTransitionError,
        OrderFiscalConflictError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

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

    try:
        delete_order_record(db, order)
    except OrderFiscalConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
