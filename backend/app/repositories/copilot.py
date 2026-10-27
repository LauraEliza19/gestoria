import uuid
from datetime import timezone

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models import CopilotRateLimit, CopilotToolAuditLog, Customer, Order
from app.schemas.copilot import (
    CopilotAuditListArguments,
    CopilotAuditRead,
    CopilotAuditWrite,
    CopilotOrdersArguments,
    CopilotOrdersResult,
    CopilotRateLimitArguments,
)


class CopilotRepository:
    @staticmethod
    def list_orders_in_preparation(
        db: Session,
        *,
        organization_id: uuid.UUID,
        arguments: CopilotOrdersArguments,
    ) -> CopilotOrdersResult:
        arguments = CopilotOrdersArguments.model_validate(arguments)
        filters = (
            Order.organization_id == organization_id,
            Customer.organization_id == organization_id,
            Order.status == "in_preparation",
        )
        # Project scalars instead of loading ORM relationships. A corrupted
        # cross-tenant customer link must not leak the other company's name.
        total = db.scalar(
            select(func.count(Order.id))
            .join(Customer, Order.customer_id == Customer.id)
            .where(*filters)
        )
        rows = db.execute(
            select(
                Order.id,
                Customer.name.label("customer_name"),
                Order.total_amount,
                Order.created_at,
            )
            .join(Customer, Order.customer_id == Customer.id)
            .where(*filters)
            .order_by(Order.created_at.desc(), Order.id)
            .limit(arguments.limit)
        ).mappings()
        orders = []
        for row in rows:
            values = dict(row)
            created_at = values["created_at"]
            values["created_at"] = (
                created_at.replace(tzinfo=timezone.utc)
                if created_at.tzinfo is None
                else created_at.astimezone(timezone.utc)
            )
            orders.append(values)
        return CopilotOrdersResult(total=int(total or 0), orders=tuple(orders))

    @staticmethod
    def consume_rate_limit(
        db: Session,
        *,
        organization_id: uuid.UUID,
        arguments: CopilotRateLimitArguments,
    ) -> int:
        arguments = CopilotRateLimitArguments.model_validate(arguments)
        insert = (
            pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
        )
        statement = insert(CopilotRateLimit).values(
            organization_id=organization_id,
            user_id=arguments.user_id,
            window=arguments.window,
            attempts=1,
        )
        statement = statement.on_conflict_do_update(
            index_elements=["organization_id", "user_id", "window"],
            set_={"attempts": CopilotRateLimit.attempts + 1},
        ).returning(CopilotRateLimit.attempts)
        attempts = db.scalar(statement)
        db.execute(
            delete(CopilotRateLimit).where(
                CopilotRateLimit.organization_id == organization_id,
                CopilotRateLimit.user_id == arguments.user_id,
                CopilotRateLimit.window < arguments.window - 1,
            )
        )
        db.commit()
        return int(attempts)

    @staticmethod
    def write_tool_audit(
        db: Session,
        *,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        entry: CopilotAuditWrite,
    ) -> None:
        entry = CopilotAuditWrite.model_validate(entry)
        db.add(
            CopilotToolAuditLog(
                organization_id=organization_id,
                user_id=user_id,
                **entry.model_dump(mode="json"),
            )
        )
        db.commit()

    @staticmethod
    def list_tool_audit_logs(
        db: Session,
        *,
        organization_id: uuid.UUID,
        arguments: CopilotAuditListArguments,
    ) -> list[CopilotAuditRead]:
        arguments = CopilotAuditListArguments.model_validate(arguments)
        rows = db.scalars(
            select(CopilotToolAuditLog)
            .where(CopilotToolAuditLog.organization_id == organization_id)
            .order_by(CopilotToolAuditLog.created_at.desc(), CopilotToolAuditLog.id)
            .limit(arguments.limit)
        )
        return [CopilotAuditRead.model_validate(row) for row in rows]
