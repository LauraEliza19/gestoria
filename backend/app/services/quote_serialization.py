from decimal import ROUND_HALF_UP, Decimal

from app.schemas.quote import QuoteItemRead, QuoteRead

_MONEY_QUANTUM = Decimal("0.01")
_HUNDRED = Decimal(100)


def _round_money(value: Decimal) -> Decimal:
    return value.quantize(
        _MONEY_QUANTUM,
        rounding=ROUND_HALF_UP,
    )


def _calculate_percentage(
    amount: Decimal,
    percentage: Decimal,
) -> Decimal:
    return _round_money(amount * percentage / _HUNDRED)


def quote_to_read(quote) -> QuoteRead:
    item_reads: list[QuoteItemRead] = []

    for item in quote.items:
        gross_amount = _round_money(item.unit_price * item.quantity)
        discount_amount = _calculate_percentage(
            gross_amount,
            item.discount_percent,
        )
        total_amount = _round_money(gross_amount - discount_amount)

        item_reads.append(
            QuoteItemRead(
                id=item.id,
                product_id=item.product_id,
                product_code=(item.product.code if item.product else "N/D"),
                product_name=(
                    item.product.name if item.product else "Produto removido"
                ),
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount_percent=item.discount_percent,
                gross_amount=gross_amount,
                discount_amount=discount_amount,
                total_amount=total_amount,
            )
        )

    installment_amount = _round_money(
        quote.total_amount / Decimal(quote.installment_count)
    )

    return QuoteRead(
        id=quote.id,
        organization_id=quote.organization_id,
        customer_id=quote.customer_id,
        customer_name=(quote.customer.name if quote.customer else "Cliente removido"),
        status=quote.status,
        valid_until=quote.valid_until,
        gross_amount=quote.gross_amount,
        general_discount_percent=quote.general_discount_percent,
        discount_amount=quote.discount_amount,
        total_amount=quote.total_amount,
        payment_terms=quote.payment_terms,
        installment_count=quote.installment_count,
        installment_amount=installment_amount,
        converted_order_id=quote.converted_order_id,
        items=item_reads,
        created_at=quote.created_at,
        updated_at=quote.updated_at,
    )
