import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OrderOperation(Base):
    __tablename__ = "order_operations"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "actor_id",
            "idempotency_key",
            name="uq_order_operation_request",
        ),
        CheckConstraint(
            "status IN ('pending', 'processing', 'executed', 'cancelled')",
            name="ck_order_operation_status",
        ),
        Index("ix_order_operations_org_created", "organization_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE")
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    idempotency_key: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    envelope: Mapped[dict] = mapped_column(JSON, nullable=False)
    # The receipt contains the original result; it survives later order deletion.
    receipt: Mapped[dict | None] = mapped_column(JSON(none_as_null=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class OrderAuditEvent(Base):
    __tablename__ = "order_audit_events"
    __table_args__ = (
        Index("ix_order_audit_org_created", "organization_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE")
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    operation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("order_operations.id", ondelete="RESTRICT"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    document: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
