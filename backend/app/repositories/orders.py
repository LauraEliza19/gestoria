import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Customer, Order, OrderItem, Organization
from app.repositories.pagination import paginate


class OrderRepository:
    @staticmethod
    def list_for_organization(
        db: Session,
        organization_id: uuid.UUID,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
        status: str | None = None,
        priority: str | None = None,
        promised_from: datetime | None = None,
        promised_to: datetime | None = None,
        sort: str = "created_at",
    ):
        query = (
            select(Order)
            .options(
                joinedload(Order.customer),
                selectinload(Order.items).joinedload(OrderItem.product),
            )
            .where(Order.organization_id == organization_id)
        )
        if search:
            term = f"%{search}%"
            query = query.where(
                or_(
                    Order.customer.has(Customer.name.ilike(term)),
                    Order.code.ilike(term),
                )
            )
        if status:
            query = query.where(Order.status == status)
        if priority:
            query = query.where(Order.priority == priority)
        if promised_from:
            query = query.where(Order.promised_at >= promised_from)
        if promised_to:
            query = query.where(Order.promised_at < promised_to)
        ordering = {
            "created_at": (Order.created_at.desc(),),
            "promised_at": (Order.promised_at.asc().nulls_last(),),
            "total_amount": (Order.total_amount.desc(),),
        }[sort]
        query = query.order_by(*ordering, Order.id)
        return paginate(db, query, page, page_size, unique=True)

    @staticmethod
    def list_for_customer(
        db: Session,
        organization_id: uuid.UUID,
        customer_id: uuid.UUID,
    ) -> list[Order]:
        query = (
            select(Order)
            .options(
                joinedload(Order.customer),
                selectinload(Order.items).joinedload(OrderItem.product),
            )
            .where(
                Order.organization_id == organization_id,
                Order.customer_id == customer_id,
            )
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
            query = query.with_for_update(of=Order).execution_options(
                populate_existing=True
            )

        return db.scalar(query)

    @staticmethod
    def create(
        db: Session,
        organization_id: uuid.UUID,
        customer_id: uuid.UUID,
        *,
        promised_at: datetime | None = None,
        priority: str = "normal",
        notes: str | None = None,
    ) -> Order:
        # FOR NO KEY UPDATE serializa a numeração entre pedidos da mesma empresa
        # sem bloquear outras gravações que apenas referenciam a empresa.
        organization = db.scalar(
            select(Organization)
            .where(Organization.id == organization_id)
            .with_for_update(key_share=True)
            .execution_options(populate_existing=True)
        )
        if organization is None:
            raise ValueError("Empresa não encontrada.")
        code = f"PED-{organization.next_order_code:06d}"
        organization.next_order_code += 1

        order = Order(
            organization_id=organization_id,
            customer_id=customer_id,
            code=code,
            status="in_preparation",
            promised_at=promised_at,
            priority=priority,
            notes=notes,
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
        *,
        stock_deducted: bool = True,
    ) -> OrderItem:
        item = OrderItem(
            order_id=order_id,
            product_id=product_id,
            quantity=quantity,
            unit_price=unit_price,
            stock_deducted=stock_deducted,
        )
        db.add(item)
        db.flush()
        return item
