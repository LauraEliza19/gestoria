"""Add optimistic concurrency versions to finance entries.

Revision ID: 0013_finance_entry_versions
Revises: 2bde4cefcdec
"""

import sqlalchemy as sa

from alembic import op


revision = "0013_finance_entry_versions"
down_revision = "2bde4cefcdec"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "finance_entries",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.alter_column("finance_entries", "version", server_default=None)


def downgrade():
    op.drop_column("finance_entries", "version")
