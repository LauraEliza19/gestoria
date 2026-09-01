import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Money

class QuoteItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(gt=0, le=1_000_000)


class QuoteCreate(BaseModel):
    customer_id: uuid.UUID
    valid_until: date
    items: list[QuoteItemCreate] = Field(min_length=1)


class QuoteStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|approved|rejected)$")


class QuoteItemRead(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str 
    quantity: int
    unit_price: Money

    model_config = ConfigDict(from_attributes=True)


class QuoteRead(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    status: str
    valid_until: date
    total_amount: Money
    converted_order_id: uuid.UUID | None
    items: list[QuoteItemRead]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)