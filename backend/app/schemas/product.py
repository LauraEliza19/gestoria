import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Money


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    price: Money
    stock_quantity: int = Field(default=0, ge=0, le=2_147_483_647)
    is_active: bool = True

    model_config = ConfigDict(str_strip_whitespace=True)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    price: Money | None = None
    stock_quantity: int | None = Field(default=None, ge=0, le=2_147_483_647)
    is_active: bool | None = None

    model_config = ConfigDict(str_strip_whitespace=True)


class ProductRead(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: str | None
    price: Money
    stock_quantity: int
    is_active: bool
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
