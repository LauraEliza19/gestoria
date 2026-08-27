from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Order, Organization, OrganizationMember, Product, User
from app.repositories import (
    CustomerRepository,
    OrderItemRepository,
    OrderRepository,
    OrganizationRepository,
    ProductRepository,
    UserRepository,
)
from app.security import verify_password


@dataclass(frozen=True)
class AuthenticatedUser:
    user: User
    membership: OrganizationMember
    organization: Organization


def authenticate(db: Session, email: str, password: str) -> AuthenticatedUser | None:
    user = UserRepository.get_by_email(db, email)
    if (
        not user
        or not user.is_active
        or not verify_password(password, user.password_hash)
    ):
        return None

    membership = UserRepository.get_membership(db, user.id)
    if not membership:
        return None

    organization = OrganizationRepository.get_by_id(db, membership.organization_id)
    if not organization:
        return None

    return AuthenticatedUser(user, membership, organization)


class OrderServiceError(Exception):
    """Erro de regra de negócio ao criar/atualizar um pedido."""


class CustomerNotFoundError(OrderServiceError):
    def __init__(self):
        super().__init__("Cliente não encontrado.")


class ProductNotFoundError(OrderServiceError):
    def __init__(self, product_id):
        self.product_id = product_id
        super().__init__(f"Produto {product_id} não encontrado.")


class InsufficientStockError(OrderServiceError):
    def __init__(self, product_name: str, available: int, requested: int):
        self.product_name = product_name
        self.available = available
        self.requested = requested
        super().__init__(
            f"Estoque insuficiente para '{product_name}': "
            f"disponível {available}, solicitado {requested}."
        )


def create_order(db: Session, organization_id, customer_id, items: list) -> Order:
    """
    Cria um pedido com múltiplos itens, descontando o estoque de cada
    produto. Tudo acontece numa única transação: se qualquer item falhar
    (produto não existe ou estoque insuficiente), NADA é salvo — nem o
    pedido, nem os itens já processados antes do erro.
    """
    try:
        customer = CustomerRepository.get_for_organization(
            db, customer_id, organization_id
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
            if product.stock_quantity < quantity:
                raise InsufficientStockError(
                    product.name, product.stock_quantity, quantity
                )
            products.append((product, quantity))

        order = OrderRepository.create(db, organization_id, customer_id)
        total = Decimal(0)
        for product, quantity in products:
            product.stock_quantity -= quantity
            OrderItemRepository.create(
                db,
                order.id,
                product.id,
                quantity,
                product.price,
            )
            total += product.price * quantity

        order.total_amount = total
        db.commit()
        db.refresh(order)
        return order
    except Exception:
        db.rollback()
        raise


def update_order_status(db: Session, order: Order, status: str) -> Order:
    if order.status == status:
        return order

    try:
        if status == "cancelled":
            for item in sorted(
                order.items, key=lambda current: str(current.product_id)
            ):
                product = ProductRepository.get_for_organization(
                    db,
                    item.product_id,
                    order.organization_id,
                    for_update=True,
                )
                if product:
                    product.stock_quantity += item.quantity
        elif order.status == "cancelled":
            products: list[tuple[Product, int]] = []
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
                if product.stock_quantity < item.quantity:
                    raise InsufficientStockError(
                        product.name,
                        product.stock_quantity,
                        item.quantity,
                    )
                products.append((product, item.quantity))

            for product, quantity in products:
                product.stock_quantity -= quantity

        return OrderRepository.update_status(db, order, status)
    except Exception:
        db.rollback()
        raise


def delete_order_record(db: Session, order: Order) -> None:
    try:
        if order.status != "cancelled":
            for item in sorted(
                order.items, key=lambda current: str(current.product_id)
            ):
                product = ProductRepository.get_for_organization(
                    db,
                    item.product_id,
                    order.organization_id,
                    for_update=True,
                )
                if product:
                    product.stock_quantity += item.quantity

        OrderRepository.delete(db, order)
    except Exception:
        db.rollback()
        raise
