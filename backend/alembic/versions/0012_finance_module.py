"""Add the first finance module.

Revision ID: 0012_finance_module
Revises: 0011_employee_records
"""

import sqlalchemy as sa

from alembic import op

revision = "0012_finance_module"
down_revision = "0011_employee_records"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "organization_members",
        sa.Column(
            "finance_access_approved",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_table(
        "finance_categories",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("organization_id", "id", name="uq_finance_category_org_id"),
        sa.UniqueConstraint(
            "organization_id", "name", name="uq_finance_category_org_name"
        ),
    )
    op.create_index(
        "ix_finance_categories_org_active_name",
        "finance_categories",
        ["organization_id", "is_active", "name"],
    )
    op.create_table(
        "finance_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("description", sa.String(200), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("entry_type", sa.String(10), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("notes", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("organization_id", "id", name="uq_finance_entry_org_id"),
        sa.ForeignKeyConstraint(
            ["organization_id", "category_id"],
            ["finance_categories.organization_id", "finance_categories.id"],
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint("amount > 0", name="ck_finance_entry_amount_positive"),
        sa.CheckConstraint(
            "entry_type IN ('income', 'expense')", name="ck_finance_entry_type"
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'paid', 'cancelled')", name="ck_finance_entry_status"
        ),
    )
    op.create_index(
        "ix_finance_entries_org_date_filters",
        "finance_entries",
        ["organization_id", "transaction_date", "entry_type", "status", "category_id"],
    )
    op.create_table(
        "finance_audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_finance_audit_org_created",
        "finance_audit_events",
        ["organization_id", "created_at"],
    )


def downgrade():
    op.drop_table("finance_audit_events")
    op.drop_index("ix_finance_entries_org_date_filters", table_name="finance_entries")
    op.drop_table("finance_entries")
    op.drop_index(
        "ix_finance_categories_org_active_name", table_name="finance_categories"
    )
    op.drop_table("finance_categories")
    op.drop_column("organization_members", "finance_access_approved")
