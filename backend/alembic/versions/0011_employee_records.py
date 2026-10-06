"""Add employee warnings and occurrence records.

Revision ID: 0011_employee_records
Revises: 0010_management_foundation
"""

import sqlalchemy as sa

from alembic import op

revision = "0011_employee_records"
down_revision = "0010_management_foundation"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "management_employee_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("recorded_by_id", sa.Uuid(), nullable=False),
        sa.Column("updated_by_id", sa.Uuid(), nullable=False),
        sa.Column("resolved_by_id", sa.Uuid()),
        sa.Column("cancelled_by_id", sa.Uuid()),
        sa.Column("record_type", sa.String(20), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column("resolution_notes", sa.Text()),
        sa.Column("cancellation_reason", sa.String(500)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
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
        sa.UniqueConstraint(
            "organization_id",
            "id",
            name="uq_management_employee_record_org_id",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "employee_id"],
            [
                "management_employees.organization_id",
                "management_employees.id",
            ],
            ondelete="RESTRICT",
            name="fk_management_employee_record_employee",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "recorded_by_id"],
            [
                "organization_members.organization_id",
                "organization_members.user_id",
            ],
            ondelete="RESTRICT",
            name="fk_management_employee_record_recorded_by",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "updated_by_id"],
            [
                "organization_members.organization_id",
                "organization_members.user_id",
            ],
            ondelete="RESTRICT",
            name="fk_management_employee_record_updated_by",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "resolved_by_id"],
            [
                "organization_members.organization_id",
                "organization_members.user_id",
            ],
            ondelete="RESTRICT",
            name="fk_management_employee_record_resolved_by",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "cancelled_by_id"],
            [
                "organization_members.organization_id",
                "organization_members.user_id",
            ],
            ondelete="RESTRICT",
            name="fk_management_employee_record_cancelled_by",
        ),
        sa.CheckConstraint(
            "record_type IN ('warning', 'incident', 'commendation', 'note')",
            name="ck_management_employee_record_type",
        ),
        sa.CheckConstraint(
            "severity IN ('informational', 'low', 'medium', 'high')",
            name="ck_management_employee_record_severity",
        ),
        sa.CheckConstraint(
            "status IN ('open', 'resolved', 'cancelled')",
            name="ck_management_employee_record_status",
        ),
        sa.CheckConstraint(
            "("
            "status = 'resolved' "
            "AND resolved_at IS NOT NULL "
            "AND resolved_by_id IS NOT NULL"
            ") OR ("
            "status <> 'resolved' "
            "AND resolved_at IS NULL "
            "AND resolved_by_id IS NULL"
            ")",
            name="ck_management_employee_record_resolution",
        ),
        sa.CheckConstraint(
            "("
            "status = 'cancelled' "
            "AND cancelled_at IS NOT NULL "
            "AND cancelled_by_id IS NOT NULL "
            "AND cancellation_reason IS NOT NULL"
            ") OR ("
            "status <> 'cancelled' "
            "AND cancelled_at IS NULL "
            "AND cancelled_by_id IS NULL "
            "AND cancellation_reason IS NULL"
            ")",
            name="ck_management_employee_record_cancellation",
        ),
    )

    op.create_index(
        "ix_management_employee_records_org_employee_occurred",
        "management_employee_records",
        ["organization_id", "employee_id", "occurred_at"],
    )
    op.create_index(
        "ix_management_employee_records_org_status_occurred",
        "management_employee_records",
        ["organization_id", "status", "occurred_at"],
    )


def downgrade():
    op.drop_table("management_employee_records")
