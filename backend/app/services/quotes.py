from datetime import date, datetime
from decimal import Decimal
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
        super().__init__(
            "Não é possível alterar o status de um orçamento convertido."
        )

def create_quote(
        db: Session, organization_id, customer_id, valid_until: date, items: list
) -> Quote: 
    """Cria um orçamento com múltiplos itens. Diferente do Pedido, o Orçamento NÂO desconta estoque - é apenas 
    uma proposta, sem compromisso.  O preço de cada item é "congelado" no momento da criação, igual fazemos no Pedido.
    """

    try: 
        customer = CustomerRepository.get_for_organization(
            db, customer_id, organization_id
        )
        if not customer or not customer.is_active:
            raise CustomerNotFoundError()

        quote = QuoteRepository.create(db, organization_id, customer_id, valid_until)

        total = Decimal(0)
        for item in items:
            product = ProductRepository.get_for_organization(
                db, item.product_id, organization_id
            )
            if not product or not product.is_active:
                raise ProductNotFoundError(item.product_id)

            QuoteItemRepository.create(
                db, quote.id, product.id, item.quantity, product.price
            )
            total += product.price * item.quantity

        quote.total_amount = total
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
        _QuoteItemAsOrderItem(item.product_id, item.quantity)
        for item in quote.items
    ]

    unit_prices = {
        item.product_id: item.unit_price
        for item in quote.items
    }

    try:
        order = create_order(
            db,
            quote.organization_id,
            quote.customer_id,
            order_items,
            unit_prices=unit_prices,
            commit=False,
        )

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