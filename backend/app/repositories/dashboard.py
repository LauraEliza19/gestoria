import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Employee,
    EmployeeRecord,
    FiscalDocument,
    Order,
    Product,
    Quote,
)

FISCAL_ATTENTION_STATUSES = (
    "Em processamento",
    "Rejeitada",
    "Denegada",
)


@dataclass(frozen=True)
class DashboardSnapshot:
    sales_today: Decimal
    orders_in_preparation: int
    orders_latest_at: datetime | None
    critical_stock_items: int
    stock_latest_at: datetime | None
    fiscal_attention: int
    fiscal_latest_at: datetime | None
    expired_quotes: int
    expiring_quotes: int
    quotes_latest_at: datetime | None
    active_employees: int | None
    open_employee_records: int | None
    employee_records_latest_at: datetime | None


class DashboardRepository:
    @staticmethod
    def get_snapshot(
        db: Session,
        organization_id: uuid.UUID,
        *,
        sales_start: datetime,
        sales_end: datetime,
        today: date,
        quote_expiration_limit: date,
        include_management: bool,
    ) -> DashboardSnapshot:
        sales_today = db.scalar(
            select(func.coalesce(func.sum(Order.total_amount), 0)).where(
                Order.organization_id == organization_id,
                Order.status == "completed",
                Order.updated_at >= sales_start,
                Order.updated_at < sales_end,
            )
        )

        orders_in_preparation, orders_latest_at = db.execute(
            select(func.count(), func.max(Order.created_at)).where(
                Order.organization_id == organization_id,
                Order.status == "in_preparation",
            )
        ).one()

        critical_stock_items, stock_latest_at = db.execute(
            select(func.count(), func.max(Product.updated_at)).where(
                Product.organization_id == organization_id,
                Product.is_active.is_(True),
                Product.stock_quantity <= Product.min_stock_quantity,
            )
        ).one()

        fiscal_attention, fiscal_latest_at = db.execute(
            select(
                func.count(),
                func.max(FiscalDocument.updated_at),
            ).where(
                FiscalDocument.organization_id == organization_id,
                FiscalDocument.status.in_(FISCAL_ATTENTION_STATUSES),
            )
        ).one()

        expired_quotes, expiring_quotes, quotes_latest_at = db.execute(
            select(
                func.count().filter(
                    Quote.status == "pending",
                    Quote.valid_until < today,
                ),
                func.count().filter(
                    Quote.status == "pending",
                    Quote.valid_until >= today,
                    Quote.valid_until <= quote_expiration_limit,
                ),
                func.max(Quote.updated_at).filter(
                    Quote.status == "pending",
                    Quote.valid_until <= quote_expiration_limit,
                ),
            ).where(Quote.organization_id == organization_id)
        ).one()

        active_employees: int | None = None
        open_employee_records: int | None = None
        employee_records_latest_at: datetime | None = None

        if include_management:
            active_employees = int(
                db.scalar(
                    select(func.count())
                    .select_from(Employee)
                    .where(
                        Employee.organization_id == organization_id,
                        Employee.is_active.is_(True),
                    )
                )
                or 0
            )

            open_employee_records, employee_records_latest_at = db.execute(
                select(
                    func.count(),
                    func.max(EmployeeRecord.occurred_at),
                ).where(
                    EmployeeRecord.organization_id == organization_id,
                    EmployeeRecord.status == "open",
                )
            ).one()

        return DashboardSnapshot(
            sales_today=Decimal(sales_today or 0),
            orders_in_preparation=int(orders_in_preparation or 0),
            orders_latest_at=orders_latest_at,
            critical_stock_items=int(critical_stock_items or 0),
            stock_latest_at=stock_latest_at,
            fiscal_attention=int(fiscal_attention or 0),
            fiscal_latest_at=fiscal_latest_at,
            expired_quotes=int(expired_quotes or 0),
            expiring_quotes=int(expiring_quotes or 0),
            quotes_latest_at=quotes_latest_at,
            active_employees=active_employees,
            open_employee_records=(
                int(open_employee_records or 0)
                if open_employee_records is not None
                else None
            ),
            employee_records_latest_at=employee_records_latest_at,
        )
