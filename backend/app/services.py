from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Organization, OrganizationMember, User
from app.repositories import OrganizationRepository, UserRepository
from app.security import verify_password
from decimal import Decimal
from app.models import Order 
from app.repositories import(
    CustomerRepository,
    OrderItemRepository,
    OrderRepository,
    ProductRepository,
)


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
    customer = CustomerRepository.get_for_organization(db, customer_id, organization_id)
    if not customer:
        raise CustomerNotFoundError()

    order = OrderRepository.create(db, organization_id, customer_id)

    total = Decimal("0")
    for item in items:
        product = ProductRepository.get_for_organization(db, item.product_id, organization_id)
        if not product or not product.is_active:
            db.rollback()
            raise ProductNotFoundError(item.product_id)

        if product.stock_quantity < item.quantity:
            db.rollback()
            raise InsufficientStockError(
                product.name, product.stock_quantity, item.quantity
            )

        product.stock_quantity -= item.quantity
        OrderItemRepository.create (db, order.id, product.id, item.quantity, product.price)
        total += product.price * item.quantity

    order.total_amount = total
    db.commit()
    db.refresh(order)
    return order

def update_order_status(db: Session, order: Order, status: str) -> Order:
    return OrderRepository.update_status(db, order, status)

