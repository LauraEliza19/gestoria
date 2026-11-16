"""Planejamento de entrega e fluxo operacional dos pedidos.

Revision ID: 0018_order_delivery_planning
Revises: 0017_finance_accounts
"""

import sqlalchemy as sa

from alembic import op

revision = "0018_order_delivery_planning"
down_revision = "0017_finance_accounts"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "orders", sa.Column("promised_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "orders",
        sa.Column(
            "priority",
            sa.String(length=20),
            nullable=False,
            server_default="normal",
        ),
    )
    op.add_column("orders", sa.Column("notes", sa.String(length=1000), nullable=True))

    op.drop_constraint("ck_order_status", "orders", type_="check")
    op.create_check_constraint(
        "ck_order_status",
        "orders",
        "status IN ('in_preparation', 'in_production', 'ready', 'completed', 'cancelled')",
    )
    op.create_check_constraint(
        "ck_order_priority",
        "orders",
        "priority IN ('normal', 'high', 'urgent')",
    )
    op.create_index(
        "ix_orders_org_promised_at",
        "orders",
        ["organization_id", "promised_at"],
    )


def downgrade():
    op.execute(
        "UPDATE orders SET status = 'in_preparation' "
        "WHERE status IN ('in_production', 'ready')"
    )
    op.drop_index("ix_orders_org_promised_at", table_name="orders")
    op.drop_constraint("ck_order_priority", "orders", type_="check")
    op.drop_constraint("ck_order_status", "orders", type_="check")
    op.create_check_constraint(
        "ck_order_status",
        "orders",
        "status IN ('in_preparation', 'completed', 'cancelled')",
    )
    op.drop_column("orders", "notes")
    op.drop_column("orders", "priority")
    op.drop_column("orders", "promised_at")
