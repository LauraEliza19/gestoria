import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Order, OrderItem


class OrderRepository:
    @staticmethod
    def list_for_organization(db: Session, organization_id: uuid.UUID) -> list[Order]:
        query = (
            select(Order)
            .options(
                joinedload(Order.customer),
                selectinload(Order.items).joinedload(OrderItem.product),
            )
            .where(Order.organization_id == organization_id)
            .order_by(Order.created_at.desc())
        )
        return list(db.scalars(query).unique())

    @staticmethod
    def get_for_organization(
        db: Session,
        order_id: uuid.UUID,
        organization_id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> Order | None:
        query = (
            select(Order)
            .options(
                joinedload(Order.customer),
                selectinload(Order.items).joinedload(OrderItem.product),
            )
            .where(
                Order.id == order_id,
                Order.organization_id == organization_id,
            )
        )

        if for_update:
            query = query.with_for_update(of=Order)

        return db.scalar(query)


    @staticmethod
    def create(
        db: Session, organization_id: uuid.UUID, customer_id: uuid.UUID
    ) -> Order:
        order = Order(
            organization_id=organization_id,
            customer_id=customer_id,
            status="in_preparation",
            total_amount=0,
        )
        db.add(order)
        db.flush()
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
        db: Session,
        order_id: uuid.UUID,
        product_id: uuid.UUID,
        quantity: Decimal,
        unit_price,
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
