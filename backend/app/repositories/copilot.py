import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Order


class CopilotRepository:
    @staticmethod
    def list_orders_in_preparation(
        db: Session,
        organization_id: uuid.UUID,
        *,
        limit: int = 5,
    ) -> tuple[int, list[Order]]:
        filters = (
            Order.organization_id == organization_id,
            Order.status == "in_preparation",
        )

        total = db.scalar(select(func.count(Order.id)).where(*filters))

        query = (
            select(Order)
            .options(joinedload(Order.customer))
            .where(*filters)
            .order_by(Order.created_at.desc(), Order.id)
            .limit(limit)
        )
        orders = list(db.scalars(query).unique())

        return int(total or 0), orders
