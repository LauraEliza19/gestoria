import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OrganizationRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

    model_config = ConfigDict(from_attributes=True)


class CurrentUserRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: str
    organization: OrganizationRead


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
