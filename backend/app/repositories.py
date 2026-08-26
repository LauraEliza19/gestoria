import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Customer, Order, OrderItem, Organization, OrganizationMember, Product, User


class UserRepository:
    @staticmethod
    def get_by_email(db: Session, email: str) -> User | None:
        return db.scalar(select(User).where(User.email == email.strip().lower()))

    @staticmethod
    def get_by_id(db: Session, user_id: uuid.UUID) -> User | None:
        return db.get(User, user_id)

    @staticmethod
    def get_membership(
        db: Session, user_id: uuid.UUID, organization_id: uuid.UUID | None = None
    ) -> OrganizationMember | None:
        query = select(OrganizationMember).where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active.is_(True),
        )
        if organization_id:
            query = query.where(OrganizationMember.organization_id == organization_id)
        return db.scalar(query.order_by(OrganizationMember.created_at))


class OrganizationRepository:
    @staticmethod
    def get_by_id(db: Session, organization_id: uuid.UUID) -> Organization | None:
        return db.get(Organization, organization_id)


class ProductRepository:
    @staticmethod
    def list_for_organization(db: Session, organization_id: uuid.UUID) -> list[Product]:
        query = (
            select(Product)
            .where(Product.organization_id == organization_id)
            .order_by(Product.created_at.desc())
        )
        return list(db.scalars(query))

    @staticmethod
    def get_for_organization(
        db: Session, product_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Product | None:
        return db.scalar(
            select(Product).where(
                Product.id == product_id,
                Product.organization_id == organization_id,
            )
        )

    @staticmethod
    def create(db: Session, organization_id: uuid.UUID, values: dict) -> Product:
        product = Product(organization_id=organization_id, **values)
        db.add(product)
        db.commit()
        db.refresh(product)
        return product

    @staticmethod
    def update(db: Session, product: Product, values: dict) -> Product:
        for field, value in values.items():
            setattr(product, field, value)
        db.commit()
        db.refresh(product)
        return product

    @staticmethod
    def delete(db: Session, product: Product) -> None:
        db.delete(product)
        db.commit()

class CustomerRepository:
    @staticmethod
    def list_for_organization(db: Session, organization_id: uuid.UUID) -> list[Customer]:
        query = (
            select(Customer)
            .where(Customer.organization_id == organization_id)
            .order_by(Customer.created_at.desc())
        )
        return list(db.scalars(query))

    @staticmethod
    def get_for_organization(
        db: Session, customer_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Customer | None:
        return db.scalar(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.organization_id == organization_id,
            )
        )

    @staticmethod
    def create(db: Session, organization_id: uuid.UUID, values: dict) -> Customer:
        customer = Customer(organization_id=organization_id, **values)
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return customer

    @staticmethod
    def update(db: Session, customer: Customer, values: dict) -> Customer:
        for field, value in values.items():
            setattr(customer, field, value)
        db.commit()
        db.refresh(customer)
        return customer

    @staticmethod
    def delete(db: Session, customer: Customer) -> None:
        db.delete(customer)
        db.commit()


class OrderRepository:
    @staticmethod
    def list_for_organization(db: Session, organization_id: uuid.UUID) -> list[Order]:
        query = (
            select(Order)
            .where(Order.organization_id == organization_id)
            .order_by(Order.created_at.desc())
        )
        return list(db.scalars(query))

    @staticmethod
    def get_for_organization(
        db: Session, order_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Order | None:
        return db.scalar(
            select(Order).where(
                Order.id == order_id,
                Order.organization_id == organization_id,
            )
        )

    @staticmethod
    def create(db: Session, organization_id: uuid.UUID, customer_id: uuid.UUID) -> Order:
        order = Order(
            organization_id=organization_id,
            customer_id=customer_id,
            status="in_preparation",
            total_amount=0,
        )
        db.add(order)
        db.flush()  # gera o order.id sem finalizar a transação ainda
        return order

    @staticmethod
    def update_status(db: Session, order: Order, status: str) -> Order:
        order.status = status
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def delete(db: Session, order: Order) -> None:
        db.delete(order)
        db.commit()


class OrderItemRepository:
    @staticmethod
    def create(
        db: Session, order_id: uuid.UUID, product_id: uuid.UUID, quantity: int, unit_price
    ) -> OrderItem:
        item = OrderItem(
            order_id=order_id,
            product_id=product_id,
            quantity=quantity,
            unit_price=unit_price,
        )
        db.add(item)
        db.flush()
        return item

    @staticmethod
    def list_for_order(db: Session, order_id: uuid.UUID) -> list[OrderItem]:
        return list(db.scalars(select(OrderItem).where(OrderItem.order_id == order_id)))