import uuid
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import ItemQuantity, Money


class OrderItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: uuid.UUID
    quantity: ItemQuantity


class OrderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: uuid.UUID
    items: list[OrderItemCreate] = Field(min_length=1, max_length=100)
    promised_at: datetime | None = None
    priority: Literal["normal", "high", "urgent"] = "normal"
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("promised_at")
    @classmethod
    def promised_at_must_include_timezone(cls, value: datetime | None):
        if value is not None and value.utcoffset() is None:
            raise ValueError("Informe o fuso horário da data prometida.")
        return value.astimezone(UTC) if value is not None else None

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None):
        normalized = value.strip() if value else ""
        return normalized or None


class OrderStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal[
        "in_preparation", "in_production", "ready", "completed", "cancelled"
    ]


class OrderItemRead(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    quantity: ItemQuantity
    unit_price: Money
    # Production planning links items to recipes through the product id.
    recipe_id: uuid.UUID | None = None
    unit_of_measure: str | None = None

    model_config = ConfigDict(from_attributes=True)


class OrderRead(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    status: Literal[
        "in_preparation", "in_production", "ready", "completed", "cancelled"
    ]
    promised_at: datetime | None = None
    priority: Literal["normal", "high", "urgent"] = "normal"
    notes: str | None = None
    total_amount: Money
    items: list[OrderItemRead]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
