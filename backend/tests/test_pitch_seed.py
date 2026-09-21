from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Customer,
    Order,
    OrderItem,
    Organization,
    OrganizationMember,
    Product,
    Quote,
    QuoteItem,
    User,
)
from app.models.production import (
    Ingredient,
    Recipe,
    RecipeIngredient,
    StockItem,
)
from scripts.seed_pitch_demo import (
    PITCH_EMAIL,
    PITCH_ORGANIZATION_SLUG,
    seed_pitch_demo,
)


def count_for_organization(
    db: Session,
    model,
    organization_id,
) -> int:
    return db.scalar(
        select(func.count())
        .select_from(model)
        .where(model.organization_id == organization_id)
    )


def test_pitch_seed_is_idempotent(db: Session) -> None:
    seed_pitch_demo(db)
    seed_pitch_demo(db)

    organization = db.scalar(
        select(Organization).where(
            Organization.slug == PITCH_ORGANIZATION_SLUG,
        )
    )

    assert organization is not None
    assert organization.name == "Padaria Aurora"

    user = db.scalar(
        select(User).where(
            User.email == PITCH_EMAIL,
        )
    )

    assert user is not None
    assert user.full_name == "Marina Silva"

    membership = db.get(
        OrganizationMember,
        (organization.id, user.id),
    )

    assert membership is not None
    assert membership.role == "owner"
    assert membership.is_active is True

    expected_counts = {
        Customer: 4,
        Product: 5,
        Order: 3,
        Quote: 3,
        Ingredient: 9,
        StockItem: 8,
        Recipe: 3,
        RecipeIngredient: 11,
    }

    for model, expected in expected_counts.items():
        assert (
            count_for_organization(
                db,
                model,
                organization.id,
            )
            == expected
        )

    order_ids = select(Order.id).where(
        Order.organization_id == organization.id,
    )
    order_item_count = db.scalar(
        select(func.count())
        .select_from(OrderItem)
        .where(OrderItem.order_id.in_(order_ids))
    )
    assert order_item_count == 4

    quote_ids = select(Quote.id).where(
        Quote.organization_id == organization.id,
    )
    quote_item_count = db.scalar(
        select(func.count())
        .select_from(QuoteItem)
        .where(QuoteItem.quote_id.in_(quote_ids))
    )
    assert quote_item_count == 3

    critical_products = list(
        db.scalars(
            select(Product).where(
                Product.organization_id == organization.id,
                Product.stock_quantity
                <= Product.min_stock_quantity,
            )
        )
    )

    assert len(critical_products) == 3

    orders = list(
        db.scalars(
            select(Order).where(
                Order.organization_id == organization.id,
            )
        )
    )
    assert sum(
        order.status == "in_preparation"
        for order in orders
    ) == 1
    assert sum(
        order.status == "completed"
        for order in orders
    ) == 2

    quotes = list(
        db.scalars(
            select(Quote).where(
                Quote.organization_id == organization.id,
            )
        )
    )
    assert sum(
        quote.status == "pending"
        for quote in quotes
    ) == 2
    assert sum(
        quote.status == "approved"
        for quote in quotes
    ) == 1