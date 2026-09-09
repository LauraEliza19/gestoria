"""Signed order proposals, receipts and security audit.

Revision ID: 0004_protected_orders
Revises: e8559033a8ca
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_protected_orders"
down_revision = "e8559033a8ca"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "order_operations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("idempotency_key", sa.Uuid(), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("envelope", sa.JSON(), nullable=False),
        sa.Column("receipt", sa.JSON(none_as_null=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("organization_id", "actor_id", "idempotency_key", name="uq_order_operation_request"),
        sa.CheckConstraint("status IN ('pending', 'processing', 'executed', 'cancelled')", name="ck_order_operation_status"),
    )
    op.create_index("ix_order_operations_org_created", "order_operations", ["organization_id", "created_at"])
    op.create_table(
        "order_audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("operation_id", sa.Uuid(), sa.ForeignKey("order_operations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_order_audit_org_created", "order_audit_events", ["organization_id", "created_at"])
    op.create_index("ix_order_audit_events_operation_id", "order_audit_events", ["operation_id"])


def downgrade():
    op.drop_table("order_audit_events")
    op.drop_table("order_operations")
