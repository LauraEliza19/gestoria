import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.models import Customer, Order


@dataclass(frozen=True)
class CustomerSummary:
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    phone: str
    is_active: bool
    total_spent: Decimal
    orders_count: int
    created_at: datetime
    updated_at: datetime


class CustomerRepository:
    @staticmethod
    def list_for_organization(
        db: Session, organization_id: uuid.UUID
    ) -> list[CustomerSummary]:
        completed_total = func.coalesce(
            func.sum(
                case(
                    (Order.status == "completed", Order.total_amount),
                    else_=Decimal(0),
                )
            ),
            Decimal(0),
        )
        query = (
            select(Customer, completed_total, func.count(Order.id))
            .outerjoin(
                Order,
                and_(
                    Order.customer_id == Customer.id,
                    Order.organization_id == organization_id,
                ),
            )
            .where(Customer.organization_id == organization_id)
            .group_by(Customer.id)
            .order_by(Customer.created_at.desc())
        )
        return [
            CustomerSummary(
                id=customer.id,
                organization_id=customer.organization_id,
                name=customer.name,
                phone=customer.phone,
                is_active=customer.is_active,
                total_spent=total_spent,
                orders_count=orders_count,
                created_at=customer.created_at,
                updated_at=customer.updated_at,
            )
            for customer, total_spent, orders_count in db.execute(query)
        ]

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
