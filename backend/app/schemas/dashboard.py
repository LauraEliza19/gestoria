from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Money

DashboardHealth = Literal["healthy", "attention", "critical"]

DashboardAlertSeverity = Literal["info", "warning", "critical"]

DashboardModule = Literal[
    "orders",
    "quotes",
    "products",
    "production",
    "fiscal",
    "management",
    "financial",
]


class DashboardSummaryRead(BaseModel):
    sales_today: Money
    orders_in_preparation: int = Field(ge=0)
    blocked_recipes: int = Field(ge=0)
    critical_stock_items: int = Field(ge=0)
    fiscal_attention: int = Field(ge=0)
    active_employees: int | None = Field(default=None, ge=0)
    open_employee_records: int | None = Field(default=None, ge=0)
    financial_balance: Decimal | None = None
    financial_available: bool
    management_available: bool


class DashboardAlertRead(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    module: DashboardModule
    severity: DashboardAlertSeverity
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=500)
    impact: str = Field(min_length=1, max_length=300)
    occurred_at: datetime | None = None
    source: str = Field(min_length=1, max_length=120)
    action_label: str = Field(min_length=1, max_length=80)
    action_route: str = Field(pattern=r"^/")
    count: int = Field(ge=1)


class DashboardOverviewRead(BaseModel):
    generated_at: datetime
    health: DashboardHealth
    summary: DashboardSummaryRead
    alerts: list[DashboardAlertRead]
