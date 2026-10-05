from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models import TimestampMixin


class CostCenter(Base, TimestampMixin):
    __tablename__ = "management_cost_centers"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "id",
            name="uq_management_cost_center_org_id",
        ),
        UniqueConstraint(
            "organization_id",
            "code",
            name="uq_management_cost_center_org_code",
        ),
        UniqueConstraint(
            "organization_id",
            "name",
            name="uq_management_cost_center_org_name",
        ),
        Index(
            "ix_management_cost_centers_org_active_name",
            "organization_id",
            "is_active",
            "name",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )


class Employee(Base, TimestampMixin):
    __tablename__ = "management_employees"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "id",
            name="uq_management_employee_org_id",
        ),
        UniqueConstraint(
            "organization_id",
            "document",
            name="uq_management_employee_org_document",
        ),
        UniqueConstraint(
            "organization_id",
            "user_id",
            name="uq_management_employee_org_user",
        ),
        Index(
            "ix_management_employees_org_active_name",
            "organization_id",
            "is_active",
            "full_name",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    document: Mapped[str | None] = mapped_column(String(18))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    birth_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )


class Employment(Base, TimestampMixin):
    __tablename__ = "management_employments"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "id",
            name="uq_management_employment_org_id",
        ),
        ForeignKeyConstraint(
            ["organization_id", "employee_id"],
            [
                "management_employees.organization_id",
                "management_employees.id",
            ],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["organization_id", "cost_center_id"],
            [
                "management_cost_centers.organization_id",
                "management_cost_centers.id",
            ],
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "employment_type IN "
            "('employee', 'contractor', 'intern', 'temporary', 'partner', 'other')",
            name="ck_management_employment_type",
        ),
        CheckConstraint(
            "status IN ('active', 'on_leave', 'ended')",
            name="ck_management_employment_status",
        ),
        CheckConstraint(
            "base_salary IS NULL OR base_salary >= 0",
            name="ck_management_employment_salary_nonnegative",
        ),
        CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="ck_management_employment_dates",
        ),
        Index(
            "ix_management_employments_org_employee_status",
            "organization_id",
            "employee_id",
            "status",
        ),
        Index(
            "ix_management_employments_org_cost_center",
            "organization_id",
            "cost_center_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        nullable=False,
    )
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        nullable=True,
    )
    position_title: Mapped[str] = mapped_column(String(120), nullable=False)
    employment_type: Mapped[str] = mapped_column(
        String(20),
        default="employee",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        nullable=False,
    )
    started_at: Mapped[date] = mapped_column(Date, nullable=False)
    ended_at: Mapped[date | None] = mapped_column(Date)
    base_salary: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(String(1000))
