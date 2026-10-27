from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
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
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models import TimestampMixin


class FinanceCategory(Base, TimestampMixin):
    __tablename__ = "finance_categories"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_finance_category_org_id"),
        UniqueConstraint(
            "organization_id", "name", name="uq_finance_category_org_name"
        ),
        Index(
            "ix_finance_categories_org_active_name",
            "organization_id",
            "is_active",
            "name",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class FinanceEntry(Base, TimestampMixin):
    __tablename__ = "finance_entries"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_finance_entry_org_id"),
        ForeignKeyConstraint(
            ["organization_id", "category_id"],
            ["finance_categories.organization_id", "finance_categories.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("amount > 0", name="ck_finance_entry_amount_positive"),
        CheckConstraint(
            "entry_type IN ('income', 'expense')", name="ck_finance_entry_type"
        ),
        CheckConstraint(
            "status IN ('pending', 'paid', 'cancelled')", name="ck_finance_entry_status"
        ),
        Index(
            "ix_finance_entries_org_date_filters",
            "organization_id",
            "transaction_date",
            "entry_type",
            "status",
            "category_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    entry_type: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="pending", nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(default=1, nullable=False)


class FinanceAuditEvent(Base):
    __tablename__ = "finance_audit_events"
    __table_args__ = (
        Index("ix_finance_audit_org_created", "organization_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    document: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
