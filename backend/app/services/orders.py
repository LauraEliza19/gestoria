import uuid
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FiscalDocument, Order, Product
from app.repositories import (
    CustomerRepository,
    OrderItemRepository,
    OrderRepository,
    ProductRepository,
)
from app.services.order_finance import (
    cancel_order_receivables,
    detach_order_receivables,
    reopen_order_receivables,
)


class OrderServiceError(Exception):
    """Erro de regra de negócio ao criar/atualizar um pedido."""


class CustomerNotFoundError(OrderServiceError):
    def __init__(self):
        super().__init__("Cliente não encontrado.")


class ProductNotFoundError(OrderServiceError):
    def __init__(self, product_id):
        self.product_id = product_id
        super().__init__(f"Produto {product_id} não encontrado.")


def format_quantity(value) -> str:
    """Quantidade no padrão brasileiro, sem zeros inúteis: 3, 1,5, 0,25."""
    number = Decimal(str(value))
    if number == number.to_integral_value():
        return str(number.quantize(Decimal(1)))
    return format(number.normalize(), "f").replace(".", ",")


MADE_TO_ORDER_HINT = (
    ' Se ele é feito sob encomenda, marque "Vendido sob encomenda" '
    "no cadastro do produto para vender sem estoque pronto."
)


class InsufficientStockError(OrderServiceError):
    def __init__(
        self,
        product_name: str,
        available,
        requested,
        *,
        manufactured: bool = False,
    ):
        self.product_name = product_name
        self.available = available
        self.requested = requested
        super().__init__(
            f"Estoque insuficiente para '{product_name}': "
            f"disponível {format_quantity(available)}, "
            f"solicitado {format_quantity(requested)}."
            + (MADE_TO_ORDER_HINT if manufactured else "")
        )


def insufficient_stock(product: Product, requested) -> InsufficientStockError:
    return InsufficientStockError(
        product.name,
        product.stock_quantity,
        requested,
        manufactured=product.product_type == "manufactured",
    )


def takes_finished_stock(product: Product) -> bool:
    """Produtos sob encomenda são vendidos antes de existirem prontos."""
    return not product.made_to_order


class OrderStatusTransitionError(OrderServiceError):
    def __init__(self, current_status: str, requested_status: str):
        self.current_status = current_status
        self.requested_status = requested_status
        super().__init__(
            "Não é possível alterar o status do pedido "
            f"de '{current_status}' para '{requested_status}'."
        )


_ALLOWED_ORDER_STATUS_TRANSITIONS = {
    "in_preparation": {"in_production", "completed", "cancelled"},
    "in_production": {"ready", "completed", "cancelled"},
    "ready": {"in_production", "completed", "cancelled"},
    "completed": {"cancelled"},
    "cancelled": {"in_preparation"},
}


def create_order(
    db: Session,
    organization_id,
    customer_id,
    items: list,
    *,
    promised_at: datetime | None = None,
    priority: str = "normal",
    notes: str | None = None,
    unit_prices: dict[uuid.UUID, Decimal] | None = None,
    commit: bool = True,
) -> Order:
    """
    Cria um pedido com múltiplos itens, descontando o estoque de cada
    produto. Tudo acontece numa única transação: se qualquer item falhar,
    nada é salvo. Produtos sob encomenda não exigem nem descontam estoque.
    """
    try:
        customer = CustomerRepository.get_for_organization(
            db,
            customer_id,
            organization_id,
        )

        if not customer or not customer.is_active:
            raise CustomerNotFoundError()

        quantities = {}

        for item in items:
            quantities[item.product_id] = (
                quantities.get(item.product_id, 0) + item.quantity
            )

        products: list[tuple[Product, int]] = []

        for product_id in sorted(quantities, key=str):
            quantity = quantities[product_id]

            product = ProductRepository.get_for_organization(
                db,
                product_id,
                organization_id,
                for_update=True,
            )

            if not product or not product.is_active:
                raise ProductNotFoundError(product_id)

            if takes_finished_stock(product) and product.stock_quantity < quantity:
                raise insufficient_stock(product, quantity)

            products.append((product, quantity))

        order = OrderRepository.create(
            db,
            organization_id,
            customer_id,
            promised_at=promised_at,
            priority=priority,
            notes=notes.strip() if notes and notes.strip() else None,
        )
        total = Decimal(0)

        for product, quantity in products:
            stock_deducted = takes_finished_stock(product)
            if stock_deducted:
                product.stock_quantity -= quantity

            unit_price = (
                unit_prices[product.id] if unit_prices is not None else product.price
            )

            OrderItemRepository.create(
                db,
                order.id,
                product.id,
                quantity,
                unit_price,
                stock_deducted=stock_deducted,
            )

            total += unit_price * quantity

        order.total_amount = total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        if commit:
            db.commit()
        else:
            db.flush()

        db.refresh(order)
        return order

    except Exception:
        db.rollback()
        raise


class OrderFiscalConflictError(OrderServiceError):
    pass


def check_fiscal_documents(db, order, *, deleting=False):
    query = select(FiscalDocument.id).where(
        FiscalDocument.organization_id == order.organization_id,
        FiscalDocument.order_id == order.id,
    )
    if not deleting:
        query = query.where(
            FiscalDocument.status.in_(("Autorizada", "Em processamento"))
        )
    if db.scalar(query.limit(1)):
        raise OrderFiscalConflictError(
            "Pedido possui histórico fiscal e não pode ser excluído."
            if deleting
            else "Resolva a nota fiscal ativa antes de cancelar o pedido."
        )


def update_order_status(
    db: Session, order: Order, status: str, *, actor_id=None
) -> Order:
    """Muda o status do pedido.

    Com ``actor_id`` (o usuário que fez a mudança), as contas a receber do
    pedido acompanham: cancelar o pedido cancela as parcelas pendentes e
    reativá-lo as reabre.
    """
    if order.status == status:
        return order

    allowed_statuses = _ALLOWED_ORDER_STATUS_TRANSITIONS.get(
        order.status,
        set(),
    )
    if status not in allowed_statuses:
        raise OrderStatusTransitionError(order.status, status)

    try:
        if status == "cancelled":
            check_fiscal_documents(db, order)
            return_stock(db, order)
            if actor_id is not None:
                cancel_order_receivables(db, order, actor_id)
        elif order.status == "cancelled":
            items = []
            for item in sorted(
                order.items, key=lambda current: str(current.product_id)
            ):
                product = ProductRepository.get_for_organization(
                    db,
                    item.product_id,
                    order.organization_id,
                    for_update=True,
                )
                if not product or not product.is_active:
                    raise ProductNotFoundError(item.product_id)
                # Vale a regra atual do produto: se ele virou (ou deixou de ser)
                # sob encomenda depois do pedido, a reativação segue o cadastro.
                takes_stock = takes_finished_stock(product)
                if takes_stock and product.stock_quantity < item.quantity:
                    raise insufficient_stock(product, item.quantity)
                items.append((item, product, takes_stock))

            for item, product, takes_stock in items:
                if takes_stock:
                    product.stock_quantity -= item.quantity
                item.stock_deducted = takes_stock
            if actor_id is not None:
                reopen_order_receivables(db, order, actor_id)

        return OrderRepository.update_status(db, order, status)
    except Exception:
        db.rollback()
        raise


def return_stock(db: Session, order: Order) -> None:
    """Devolve ao estoque apenas o que o pedido realmente tirou dele."""
    for item in sorted(order.items, key=lambda current: str(current.product_id)):
        if not item.stock_deducted:
            continue
        product = ProductRepository.get_for_organization(
            db,
            item.product_id,
            order.organization_id,
            for_update=True,
        )
        if product:
            product.stock_quantity += item.quantity


def delete_order_record(db: Session, order: Order, *, actor_id=None) -> None:
    try:
        check_fiscal_documents(db, order, deleting=True)
        if order.status != "cancelled":
            return_stock(db, order)
        if actor_id is not None:
            detach_order_receivables(db, order, actor_id)

        OrderRepository.delete(db, order)
    except Exception:
        db.rollback()
        raise
