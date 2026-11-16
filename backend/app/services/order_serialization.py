from datetime import UTC, datetime

from app.schemas.order import OrderItemRead, OrderRead


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def order_to_read(order) -> OrderRead:
    return OrderRead(
        id=order.id,
        organization_id=order.organization_id,
        customer_id=order.customer_id,
        customer_name=order.customer.name if order.customer else "Cliente removido",
        status=order.status,
        promised_at=_as_utc(order.promised_at),
        priority=order.priority,
        notes=order.notes,
        total_amount=order.total_amount,
        items=[
            OrderItemRead(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else "Produto removido",
                quantity=item.quantity,
                unit_price=item.unit_price,
                recipe_id=item.product.recipe_id if item.product else None,
                unit_of_measure=(
                    item.product.unit_of_measure if item.product else None
                ),
            )
            for item in order.items
        ],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )
