from app.schemas.order import OrderItemRead, OrderRead


def order_to_read(order) -> OrderRead:
    return OrderRead(
        id=order.id,
        organization_id=order.organization_id,
        customer_id=order.customer_id,
        customer_name=order.customer.name if order.customer else "Cliente removido",
        status=order.status,
        total_amount=order.total_amount,
        items=[
            OrderItemRead(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else "Produto removido",
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            for item in order.items
        ],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )
