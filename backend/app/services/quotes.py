from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Quote
from app.repositories import (
    CustomerRepository,
    ProductRepository,
    QuoteItemRepository,
    QuoteRepository,
)
from app.services.orders import (
    CustomerNotFoundError,
    ProductNotFoundError,
    create_order,
)

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


def business_today() -> date:
    return datetime.now(ZoneInfo(settings.business_timezone)).date()


class QuoteServiceError(Exception):
    """Erro de regra de negócio ao criar/atualizar um orçamento."""


class QuoteExpiredError(QuoteServiceError):
    def __init__(self):
        super().__init__(
            "Este orçamento está vencido e não pode ser aprovado ou convertido"
        )


class QuoteNotConvertibleError(QuoteServiceError):
    def __init__(self, current_status: str):
        self.current_status = current_status
        super().__init__(
            "Só é possível converter orçamentos aprovados "
            f"(status atual: '{current_status}')"
        )


class QuoteStatusTransitionError(QuoteServiceError):
    def __init__(self, current_status: str, requested_status: str):
        self.current_status = current_status
        self.requested_status = requested_status
        super().__init__("Não é possível alterar o status de um orçamento convertido.")


def create_quote(
    db: Session,
    organization_id,
    customer_id,
    valid_until: date,
    items: list,
    *,
    general_discount_percent: Decimal = Decimal(0),
    payment_terms: str = "cash",
    installment_count: int = 1,
) -> Quote:
    """
    Cria um orçamento sem movimentar o estoque.

    Os preços dos produtos e os percentuais de desconto são congelados
    no momento da criação para preservar o histórico comercial.
    """

    try:
        customer = CustomerRepository.get_for_organization(
            db,
            customer_id,
            organization_id,
        )
        if not customer or not customer.is_active:
            raise CustomerNotFoundError()

        quote = QuoteRepository.create(
            db,
            organization_id,
            customer_id,
            valid_until,
            general_discount_percent=general_discount_percent,
            payment_terms=payment_terms,
            installment_count=installment_count,
        )

        gross_amount = Decimal(0)
        amount_after_item_discounts = Decimal(0)

        for item in items:
            product = ProductRepository.get_for_organization(
                db,
                item.product_id,
                organization_id,
            )
            if not product or not product.is_active:
                raise ProductNotFoundError(item.product_id)

            item_gross_amount = _round_money(product.price * item.quantity)
            item_discount_amount = _calculate_percentage(
                item_gross_amount,
                item.discount_percent,
            )
            item_total_amount = _round_money(item_gross_amount - item_discount_amount)

            QuoteItemRepository.create(
                db,
                quote.id,
                product.id,
                item.quantity,
                product.price,
                item.discount_percent,
            )

            gross_amount += item_gross_amount
            amount_after_item_discounts += item_total_amount

        general_discount_amount = _calculate_percentage(
            amount_after_item_discounts,
            general_discount_percent,
        )
        total_amount = _round_money(
            amount_after_item_discounts - general_discount_amount
        )

        quote.gross_amount = _round_money(gross_amount)
        quote.discount_amount = _round_money(quote.gross_amount - total_amount)
        quote.total_amount = total_amount

        db.commit()
        db.refresh(quote)
        return quote
    except Exception:
        db.rollback()
        raise


def update_quote_status(db: Session, quote: Quote, status: str) -> Quote:
    if quote.status == "converted":
        raise QuoteStatusTransitionError(quote.status, status)

    if status == "approved" and quote.valid_until < business_today():
        raise QuoteExpiredError()

    return QuoteRepository.update_status(db, quote, status)


def convert_quote_to_order(db: Session, quote: Quote) -> Quote:
    """
    Converte um orçamento aprovado em um pedido usando uma única transação.
    """
    if quote.status != "approved":
        raise QuoteNotConvertibleError(quote.status)

    if quote.valid_until < business_today():
        raise QuoteExpiredError()

    order_items = [
        _QuoteItemAsOrderItem(
            item.product_id,
            item.quantity,
        )
        for item in quote.items
    ]

    unit_prices: dict = {}

    for item in quote.items:
        item_gross_amount = _round_money(item.unit_price * item.quantity)
        item_discount_amount = _calculate_percentage(
            item_gross_amount,
            item.discount_percent,
        )
        amount_after_item_discount = _round_money(
            item_gross_amount - item_discount_amount
        )
        general_discount_amount = _calculate_percentage(
            amount_after_item_discount,
            quote.general_discount_percent,
        )
        item_final_amount = _round_money(
            amount_after_item_discount - general_discount_amount
        )

        unit_prices[item.product_id] = _round_money(item_final_amount / item.quantity)

    try:
        order = create_order(
            db,
            quote.organization_id,
            quote.customer_id,
            order_items,
            unit_prices=unit_prices,
            commit=False,
        )

        order.total_amount = quote.total_amount

        QuoteRepository.mark_converted(
            db,
            quote,
            order.id,
            commit=False,
        )

        db.commit()
        db.refresh(quote)
        return quote

    except Exception:
        db.rollback()
        raise


class _QuoteItemAsOrderItem:
    """
    Adaptador simples: 'create_order' espera objetos com .product_id e
    .quantity (como o OrderItemCreate do schema). Os itens do Quote já têm
    esses mesmos campos, mas não é o mesmo tipo — essa classe faz a ponte
    sem precisar duplicar a lógica de create_order.
    """

    def __init__(self, product_id, quantity):
        self.product_id = product_id
        self.quantity = quantity


def delete_quote_record(db: Session, quote: Quote) -> None:
    QuoteRepository.delete(db, quote)
