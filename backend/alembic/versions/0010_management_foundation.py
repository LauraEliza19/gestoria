"""Add the internal management foundation.

Revision ID: 0010_management_foundation
Revises: 0009_cookie_sessions
"""

import sqlalchemy as sa

from alembic import op

revision = "0010_management_foundation"
down_revision = "0009_cookie_sessions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "management_cost_centers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(30), nullable=False),
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
        sa.UniqueConstraint(
            "organization_id",
            "id",
            name="uq_management_cost_center_org_id",
        ),
        sa.UniqueConstraint(
            "organization_id",
            "code",
            name="uq_management_cost_center_org_code",
        ),
        sa.UniqueConstraint(
            "organization_id",
            "name",
            name="uq_management_cost_center_org_name",
        ),
    )
    op.create_index(
        "ix_management_cost_centers_org_active_name",
        "management_cost_centers",
        ["organization_id", "is_active", "name"],
    )

    op.create_table(
        "management_employees",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("document", sa.String(18)),
        sa.Column("email", sa.String(255)),
        sa.Column("phone", sa.String(30)),
        sa.Column("birth_date", sa.Date()),
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
        sa.UniqueConstraint(
            "organization_id",
            "id",
            name="uq_management_employee_org_id",
        ),
        sa.UniqueConstraint(
            "organization_id",
            "document",
            name="uq_management_employee_org_document",
        ),
        sa.UniqueConstraint(
            "organization_id",
            "user_id",
            name="uq_management_employee_org_user",
        ),
    )
    op.create_index(
        "ix_management_employees_org_active_name",
        "management_employees",
        ["organization_id", "is_active", "full_name"],
    )

    op.create_table(
        "management_employments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("cost_center_id", sa.Uuid()),
        sa.Column("position_title", sa.String(120), nullable=False),
        sa.Column("employment_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("started_at", sa.Date(), nullable=False),
        sa.Column("ended_at", sa.Date()),
        sa.Column("base_salary", sa.Numeric(12, 2)),
        sa.Column("notes", sa.String(1000)),
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
            name="uq_management_employment_org_id",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "employee_id"],
            [
                "management_employees.organization_id",
                "management_employees.id",
            ],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "cost_center_id"],
            [
                "management_cost_centers.organization_id",
                "management_cost_centers.id",
            ],
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "employment_type IN "
            "('employee', 'contractor', 'intern', 'temporary', 'partner', 'other')",
            name="ck_management_employment_type",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'on_leave', 'ended')",
            name="ck_management_employment_status",
        ),
        sa.CheckConstraint(
            "base_salary IS NULL OR base_salary >= 0",
            name="ck_management_employment_salary_nonnegative",
        ),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="ck_management_employment_dates",
        ),
    )
    op.create_index(
        "ix_management_employments_org_employee_status",
        "management_employments",
        ["organization_id", "employee_id", "status"],
    )
    op.create_index(
        "ix_management_employments_org_cost_center",
        "management_employments",
        ["organization_id", "cost_center_id"],
    )


def downgrade():
    op.drop_table("management_employments")
    op.drop_table("management_employees")
    op.drop_table("management_cost_centers")
