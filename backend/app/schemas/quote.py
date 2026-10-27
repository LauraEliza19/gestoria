import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import ItemQuantity, Money

DiscountPercent = Annotated[
    Decimal,
    Field(
        ge=0,
        le=100,
        max_digits=5,
        decimal_places=2,
    ),
]

PaymentTerms = Literal["cash", "installments"]


class QuoteItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: ItemQuantity
    discount_percent: DiscountPercent = Decimal(0)


class QuoteCreate(BaseModel):
    customer_id: uuid.UUID
    valid_until: date
    general_discount_percent: DiscountPercent = Decimal(0)
    payment_terms: PaymentTerms = "cash"
    installment_count: int = Field(default=1, ge=1, le=24)
    items: list[QuoteItemCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_payment_terms(self):
        if self.payment_terms == "cash" and self.installment_count != 1:
            raise ValueError("Pagamentos à vista devem possuir exatamente uma parcela.")

        if self.payment_terms == "installments" and self.installment_count < 2:
            raise ValueError(
                "Pagamentos parcelados devem possuir pelo menos duas parcelas."
            )

        return self


class QuoteStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|approved|rejected)$")


class QuoteItemRead(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_code: str
    product_name: str
    quantity: ItemQuantity
    unit_price: Money
    discount_percent: DiscountPercent
    gross_amount: Money
    discount_amount: Money
    total_amount: Money

    model_config = ConfigDict(from_attributes=True)


class QuoteRead(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    status: str
    valid_until: date
    gross_amount: Money
    general_discount_percent: DiscountPercent
    discount_amount: Money
    total_amount: Money
    payment_terms: PaymentTerms
    installment_count: int
    installment_amount: Money
    converted_order_id: uuid.UUID | None
    items: list[QuoteItemRead]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
