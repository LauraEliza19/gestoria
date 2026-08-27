"""Add indexes used by tenant-scoped customer and order queries.

Revision ID: 0003
Revises: c1f605ddacfc
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "c1f605ddacfc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_products_org_created_at",
        "products",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_customers_org_created_at",
        "customers",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_customers_org_name",
        "customers",
        ["organization_id", "name"],
    )
    op.create_index(
        "ix_orders_org_created_at",
        "orders",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_orders_org_status_created_at",
        "orders",
        ["organization_id", "status", "created_at"],
    )
    op.create_index(
        "ix_orders_org_customer",
        "orders",
        ["organization_id", "customer_id"],
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])
    op.create_index("ix_order_items_product_id", "order_items", ["product_id"])


def downgrade() -> None:
    op.drop_index("ix_order_items_product_id", table_name="order_items")
    op.drop_index("ix_order_items_order_id", table_name="order_items")
    op.drop_index("ix_orders_org_customer", table_name="orders")
    op.drop_index("ix_orders_org_status_created_at", table_name="orders")
    op.drop_index("ix_orders_org_created_at", table_name="orders")
    op.drop_index("ix_customers_org_name", table_name="customers")
    op.drop_index("ix_customers_org_created_at", table_name="customers")
    op.drop_index("ix_products_org_created_at", table_name="products")
