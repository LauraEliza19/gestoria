"""Shared Copilot limits and tenant-bound tool audit logs.

Revision ID: 0014_copilot_security_gateway
Revises: 0013_finance_entry_versions
"""

import sqlalchemy as sa

from alembic import op

revision = "0014_copilot_security_gateway"
down_revision = "0013_finance_entry_versions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "copilot_tool_audit_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("question_id", sa.String(50)),
        sa.Column("tool_name", sa.String(80), nullable=False),
        sa.Column("input_payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("execution_time_ms", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "user_id"],
            ["organization_members.organization_id", "organization_members.user_id"],
            ondelete="RESTRICT",
            name="fk_copilot_audit_membership",
        ),
        sa.CheckConstraint(
            "status IN ('executed', 'denied', 'rate_limited', 'error')",
            name="ck_copilot_audit_status",
        ),
        sa.CheckConstraint("execution_time_ms >= 0", name="ck_copilot_audit_duration"),
    )
    for column in ("organization_id", "user_id", "question_id", "tool_name"):
        op.create_index(
            f"ix_copilot_tool_audit_logs_{column}", "copilot_tool_audit_logs", [column]
        )
    op.create_index(
        "ix_copilot_audit_org_created",
        "copilot_tool_audit_logs",
        ["organization_id", "created_at"],
    )
    op.create_table(
        "copilot_rate_limits",
        sa.Column("organization_id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), primary_key=True),
        sa.Column("window", sa.Integer(), primary_key=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id", "user_id"],
            ["organization_members.organization_id", "organization_members.user_id"],
            ondelete="CASCADE",
            name="fk_copilot_rate_limit_membership",
        ),
        sa.CheckConstraint("attempts > 0", name="ck_copilot_rate_limit_attempts"),
    )


def downgrade():
    if op.get_context().as_sql:
        raise RuntimeError(
            "O downgrade do gateway exige conexão para preservar a auditoria."
        )
    audit_table = sa.table("copilot_tool_audit_logs")
    if op.get_bind().scalar(sa.select(sa.func.count()).select_from(audit_table)):
        raise RuntimeError(
            "Downgrade bloqueado: preserve os registros de auditoria do Copiloto."
        )
    op.drop_table("copilot_rate_limits")
    op.drop_table("copilot_tool_audit_logs")
