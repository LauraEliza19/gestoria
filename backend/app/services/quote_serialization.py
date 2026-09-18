from app.schemas.quote import QuoteItemRead, QuoteRead


def quote_to_read(quote) -> QuoteRead:
    return QuoteRead(
        id=quote.id,
        organization_id=quote.organization_id,
        customer_id=quote.customer_id,
        customer_name=(
            quote.customer.name
            if quote.customer
            else "Cliente removido"
        ),
        status=quote.status,
        valid_until=quote.valid_until,
        total_amount=quote.total_amount,
        converted_order_id=quote.converted_order_id,
        items=[
            QuoteItemRead(
                id=item.id,
                product_id=item.product_id,
                product_name=(
                    item.product.name
                    if item.product
                    else "Produto removido"
                ),
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            for item in quote.items
        ],
        created_at=quote.created_at,
        updated_at=quote.updated_at,
    )