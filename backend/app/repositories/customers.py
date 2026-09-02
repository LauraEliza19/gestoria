import uuid
from dataclasses import dataclass
from datetime import date, datetime
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

    person_type: str
    document: str | None
    trade_name: str | None
    state_registration: str | None

    whatsapp: str | None
    email: str | None

    birth_date: date | None
    category: str
    default_discount_percent: Decimal | None
    notes: str | None

    postal_code: str | None
    street: str | None
    number: str | None
    complement: str | None
    neighborhood: str | None
    city: str | None
    state: str | None

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
                person_type=customer.person_type,
                document=customer.document,
                trade_name=customer.trade_name,
                state_registration=customer.state_registration,
                whatsapp=customer.whatsapp,
                email=customer.email,
                birth_date=customer.birth_date,
                category=customer.category,
                default_discount_percent=customer.default_discount_percent,
                notes=customer.notes,
                postal_code=customer.postal_code,
                street=customer.street,
                number=customer.number,
                complement=customer.complement,
                neighborhood=customer.neighborhood,
                city=customer.city,
                state=customer.state,
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