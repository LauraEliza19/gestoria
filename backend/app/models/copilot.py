import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CopilotToolAuditLog(Base):
    __tablename__ = "copilot_tool_audit_logs"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "user_id"],
            ["organization_members.organization_id", "organization_members.user_id"],
            ondelete="RESTRICT",
            name="fk_copilot_audit_membership",
        ),
        CheckConstraint(
            "status IN ('executed', 'denied', 'rate_limited', 'error')",
            name="ck_copilot_audit_status",
        ),
        CheckConstraint("execution_time_ms >= 0", name="ck_copilot_audit_duration"),
        Index("ix_copilot_audit_org_created", "organization_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="RESTRICT"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    question_id: Mapped[str | None] = mapped_column(String(50), index=True)
    tool_name: Mapped[str] = mapped_column(String(80), index=True)
    input_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    execution_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )


class CopilotRateLimit(Base):
    __tablename__ = "copilot_rate_limits"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "user_id"],
            ["organization_members.organization_id", "organization_members.user_id"],
            ondelete="CASCADE",
            name="fk_copilot_rate_limit_membership",
        ),
        CheckConstraint("attempts > 0", name="ck_copilot_rate_limit_attempts"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    window: Mapped[int] = mapped_column(Integer, primary_key=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False)
