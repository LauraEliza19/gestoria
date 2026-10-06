from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
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


class EmployeeRecord(Base, TimestampMixin):
    __tablename__ = "management_employee_records"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "id",
            name="uq_management_employee_record_org_id",
        ),
        ForeignKeyConstraint(
            ["organization_id", "employee_id"],
            [
                "management_employees.organization_id",
                "management_employees.id",
            ],
            ondelete="RESTRICT",
            name="fk_management_employee_record_employee",
        ),
        ForeignKeyConstraint(
            ["organization_id", "recorded_by_id"],
            [
                "organization_members.organization_id",
                "organization_members.user_id",
            ],
            ondelete="RESTRICT",
            name="fk_management_employee_record_recorded_by",
        ),
        ForeignKeyConstraint(
            ["organization_id", "updated_by_id"],
            [
                "organization_members.organization_id",
                "organization_members.user_id",
            ],
            ondelete="RESTRICT",
            name="fk_management_employee_record_updated_by",
        ),
        ForeignKeyConstraint(
            ["organization_id", "resolved_by_id"],
            [
                "organization_members.organization_id",
                "organization_members.user_id",
            ],
            ondelete="RESTRICT",
            name="fk_management_employee_record_resolved_by",
        ),
        ForeignKeyConstraint(
            ["organization_id", "cancelled_by_id"],
            [
                "organization_members.organization_id",
                "organization_members.user_id",
            ],
            ondelete="RESTRICT",
            name="fk_management_employee_record_cancelled_by",
        ),
        CheckConstraint(
            "record_type IN ('warning', 'incident', 'commendation', 'note')",
            name="ck_management_employee_record_type",
        ),
        CheckConstraint(
            "severity IN ('informational', 'low', 'medium', 'high')",
            name="ck_management_employee_record_severity",
        ),
        CheckConstraint(
            "status IN ('open', 'resolved', 'cancelled')",
            name="ck_management_employee_record_status",
        ),
        CheckConstraint(
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
        CheckConstraint(
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
        Index(
            "ix_management_employee_records_org_employee_occurred",
            "organization_id",
            "employee_id",
            "occurred_at",
        ),
        Index(
            "ix_management_employee_records_org_status_occurred",
            "organization_id",
            "status",
            "occurred_at",
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
    recorded_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        nullable=False,
    )
    updated_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        nullable=False,
    )
    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        nullable=True,
    )
    cancelled_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        nullable=True,
    )
    record_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        default="informational",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="open",
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(160),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    cancellation_reason: Mapped[str | None] = mapped_column(
        String(500),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
    )
