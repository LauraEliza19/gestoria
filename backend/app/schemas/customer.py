import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import Money, normalize_phone


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=1, max_length=30)

    person_type: str = Field(default="individual", pattern="^(individual|company)$")
    document: str | None = Field(default=None, max_length=18)
    trade_name: str | None = Field(default=None, max_length=120)
    state_registration: str | None = Field(default=None, max_length=30)

    whatsapp: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None

    birth_date: date | None = None
    category: str = Field(default="final_consumer", pattern="^(final_consumer|reseller|event)$")
    default_discount_percent: Decimal | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=1000)

    postal_code: str | None = Field(default=None, max_length=9)
    street: str | None = Field(default=None, max_length=160)
    number: str | None = Field(default=None, max_length=20)
    complement: str | None = Field(default=None, max_length=80)
    neighborhood: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=80)
    state: str | None = Field(default=None, max_length=2)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("phone", "whatsapp")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        return normalize_phone(value) if value is not None else None


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, min_length=1, max_length=30)
    is_active: bool | None = None

    person_type: str | None = Field(default=None, pattern="^(individual|company)$")
    document: str | None = Field(default=None, max_length=18)
    trade_name: str | None = Field(default=None, max_length=120)
    state_registration: str | None = Field(default=None, max_length=30)

    whatsapp: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None

    birth_date: date | None = None
    category: str | None = Field(default=None, pattern="^(final_consumer|reseller|event)$")
    default_discount_percent: Decimal | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=1000)

    postal_code: str | None = Field(default=None, max_length=9)
    street: str | None = Field(default=None, max_length=160)
    number: str | None = Field(default=None, max_length=20)
    complement: str | None = Field(default=None, max_length=80)
    neighborhood: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=80)
    state: str | None = Field(default=None, max_length=2)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("phone", "whatsapp")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        return normalize_phone(value) if value is not None else None


class CustomerRead(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    phone: str
    is_active: bool
    total_spent: Money = Decimal(0)
    orders_count: int = 0

    person_type: str
    document: str | None
    trade_name: str | None
    state_registration: str | None

    whatsapp: str | None
    email: str | None

    birth_date: date | None
    category: str
    default_discount_percent: Decimal | None
    notes: str | None

    postal_code: str | None
    street: str | None
    number: str | None
    complement: str | None
    neighborhood: str | None
    city: str | None
    state: str | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)