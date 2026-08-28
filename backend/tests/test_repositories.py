import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization
from app.repositories import (
    CustomerRepository,
    OrganizationRepository,
    ProductRepository,
    UserRepository,
)


def test_user_repository_finds_membership_and_normalizes_email(db: Session) -> None:
    user = UserRepository.get_by_email(db, "  LUCAS@gestoria.dev  ")
    assert user is not None
    assert user.email == "lucas@gestoria.dev"

    membership = UserRepository.get_membership(db, user.id)
    assert membership is not None
    assert membership.role == "owner"

    other = OrganizationRepository.get_by_id(db, membership.organization_id)
    assert other is not None
    scoped = UserRepository.get_membership(db, user.id, other.id)
    assert scoped is not None

    missing = UserRepository.get_membership(db, user.id, uuid.uuid4())
    assert missing is None


def test_product_repository_is_scoped_to_organization(db: Session) -> None:
    org_a = db.scalar(select(Organization).where(Organization.slug == "empresa-a"))
    org_b = db.scalar(select(Organization).where(Organization.slug == "empresa-b"))
    assert org_a is not None and org_b is not None

    created = ProductRepository.create(
        db,
        org_a.id,
        {
            "name": "Croissant",
            "price": Decimal("8.00"),
            "stock_quantity": 4,
            "is_active": True,
        },
    )

    listed = ProductRepository.list_for_organization(db, org_a.id)
    assert [item.name for item in listed] == ["Croissant"]
    assert ProductRepository.get_for_organization(db, created.id, org_b.id) is None
    assert ProductRepository.get_for_organization(db, created.id, org_a.id) is not None


def test_customer_repository_aggregates_completed_orders_only(db: Session) -> None:
    from app.schemas import OrderItemCreate
    from app.services import create_order, update_order_status

    org_a = db.scalar(select(Organization).where(Organization.slug == "empresa-a"))
    assert org_a is not None
    customer = CustomerRepository.create(
        db, org_a.id, {"name": "Ana", "phone": "35977776666"}
    )
    product = ProductRepository.create(
        db,
        org_a.id,
        {
            "name": "Bolo",
            "price": Decimal("20.00"),
            "stock_quantity": 10,
            "is_active": True,
        },
    )
    completed = create_order(
        db,
        org_a.id,
        customer.id,
        [OrderItemCreate(product_id=product.id, quantity=2)],
    )
    update_order_status(db, completed, "completed")
    create_order(
        db,
        org_a.id,
        customer.id,
        [OrderItemCreate(product_id=product.id, quantity=1)],
    )

    summaries = CustomerRepository.list_for_organization(db, org_a.id)
    assert summaries[0].name == "Ana"
    assert summaries[0].total_spent == Decimal("40.00")
    assert summaries[0].orders_count == 2
