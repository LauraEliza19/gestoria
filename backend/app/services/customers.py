import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.repositories import CustomerRepository, OrderRepository
from app.schemas import CustomerProfileRead, CustomerRead
from app.services.order_serialization import order_to_read


def get_customer_profile(
    db: Session,
    organization_id: uuid.UUID,
    customer_id: uuid.UUID,
) -> CustomerProfileRead | None:
    customer = CustomerRepository.get_for_organization(
        db,
        customer_id,
        organization_id,
    )

    if customer is None:
        return None

    orders = OrderRepository.list_for_customer(
        db,
        organization_id,
        customer_id,
    )

    completed_orders = [
        order
        for order in orders
        if order.status == "completed"
    ]

    total_spent = sum(
        (
            order.total_amount
            for order in completed_orders
        ),
        Decimal(0),
    )

    last_purchase_at = max(
        (
            order.created_at
            for order in completed_orders
        ),
        default=None,
    )

    profile_data = CustomerRead.model_validate(
        customer
    ).model_dump()

    profile_data.update(
        total_spent=total_spent,
        orders_count=len(orders),
        last_purchase_at=last_purchase_at,
        orders=[
            order_to_read(order)
            for order in orders
        ],
    )

    return CustomerProfileRead.model_validate(
        profile_data
    )