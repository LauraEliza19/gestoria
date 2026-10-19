import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FinanceType = Literal["income", "expense"]
FinanceStatus = Literal["pending", "paid", "cancelled"]


class FinanceCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    model_config = ConfigDict(str_strip_whitespace=True)


class FinanceCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None
    model_config = ConfigDict(str_strip_whitespace=True)


class FinanceCategoryRead(FinanceCategoryCreate):
    id: uuid.UUID
    organization_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FinanceEntryCreate(BaseModel):
    category_id: uuid.UUID
    description: str = Field(min_length=1, max_length=200)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    entry_type: FinanceType
    status: FinanceStatus = "pending"
    transaction_date: date
    paid_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=5000)
    model_config = ConfigDict(str_strip_whitespace=True)


class FinanceEntryUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    description: str | None = Field(default=None, min_length=1, max_length=200)
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    entry_type: FinanceType | None = None
    status: FinanceStatus | None = None
    transaction_date: date | None = None
    paid_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=5000)
    model_config = ConfigDict(str_strip_whitespace=True)


class FinanceEntryRead(FinanceEntryCreate):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FinanceSummaryRead(BaseModel):
    total_income: Decimal
    total_expense: Decimal
    balance: Decimal
    realized_status: Literal["paid"] = "paid"
