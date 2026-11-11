"""Contas a pagar e receber: vencimento e anexos.

Revision ID: 0017_finance_accounts
Revises: 0016_quote_commercial_terms
"""

import sqlalchemy as sa

from alembic import op

revision = "0017_finance_accounts"
down_revision = "0016_quote_commercial_terms"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("finance_entries", sa.Column("due_date", sa.Date(), nullable=True))
    # Lançamentos existentes vencem na própria data do lançamento.
    op.execute("UPDATE finance_entries SET due_date = transaction_date")
    op.alter_column("finance_entries", "due_date", nullable=False)

    op.create_table(
        "finance_attachments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entry_id", sa.Uuid(), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column(
            "uploaded_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "entry_id"],
            ["finance_entries.organization_id", "finance_entries.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_finance_attachments_org_entry",
        "finance_attachments",
        ["organization_id", "entry_id"],
    )


def downgrade():
    op.drop_index("ix_finance_attachments_org_entry", table_name="finance_attachments")
    op.drop_table("finance_attachments")
    op.drop_column("finance_entries", "due_date")
