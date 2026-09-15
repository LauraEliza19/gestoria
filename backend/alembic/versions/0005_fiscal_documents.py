"""Add fiscal document registry.

Revision ID: 0005_fiscal_documents
Revises: 0004_protected_orders
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_fiscal_documents"
down_revision: Union[str, None] = "0004_protected_orders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fiscal_documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("orders.id", ondelete="SET NULL")),
        sa.Column("document_type", sa.String(10), nullable=False),
        sa.Column("number", sa.String(30), nullable=False),
        sa.Column("series", sa.String(20), nullable=False, server_default="1"),
        sa.Column("model", sa.String(10), nullable=False, server_default="55"),
        sa.Column("participant_name", sa.String(160), nullable=False),
        sa.Column("participant_document", sa.String(18)),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("cfop", sa.String(10)),
        sa.Column("operation_nature", sa.String(160)),
        sa.Column("value", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(30), nullable=False, server_default="Em processamento"),
        sa.Column("access_key", sa.String(44), unique=True),
        sa.Column("xml_available", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("pdf_available", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("document_type IN ('saida', 'entrada')", name="ck_fiscal_document_type"),
        sa.CheckConstraint("model IN ('55', '65', 'NFS-e')", name="ck_fiscal_document_model"),
        sa.CheckConstraint("status IN ('Autorizada', 'Em processamento', 'Cancelada', 'Rejeitada', 'Inutilizada', 'Denegada')", name="ck_fiscal_document_status"),
        sa.CheckConstraint("value >= 0", name="ck_fiscal_document_value_nonnegative"),
    )
    op.create_index("ix_fiscal_documents_org_date", "fiscal_documents", ["organization_id", "issue_date"])
    op.create_index("ix_fiscal_documents_org_type_status", "fiscal_documents", ["organization_id", "document_type", "status"])


def downgrade() -> None:
    op.drop_index("ix_fiscal_documents_org_type_status", table_name="fiscal_documents")
    op.drop_index("ix_fiscal_documents_org_date", table_name="fiscal_documents")
    op.drop_table("fiscal_documents")