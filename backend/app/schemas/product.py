import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Money, StockQuantity

__all__ = ["ProductCreate", "ProductRead", "ProductUpdate"]


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    price: Money
    stock_quantity: StockQuantity = Decimal(0)
    is_active: bool = True

    # ---- Classificação ----
    category: str = Field(default="outros", pattern="^(padaria|frios|bebidas|outros)$")
    product_type: str = Field(default="resale", pattern="^(manufactured|resale)$")
    unit_of_measure: str = Field(default="unit", pattern="^(unit|kg|g)$")

    # ---- Estoque e custo ----
    cost_price: Money | None = None
    min_stock_quantity: StockQuantity = Decimal(5)

    # ---- Perecibilidade ----
    perishable: bool = False
    shelf_life_days: int | None = Field(default=None, gt=0)

    # ---- Identificação ----
    barcode: str | None = Field(default=None, max_length=50)

    # ---- Fiscal (estrutura pronta pra fase 3) ----
    ncm_code: str | None = Field(default=None, pattern=r"^\d{8}$")
    cest_code: str | None = Field(default=None, pattern=r"^\d{7}$")
    fiscal_origin: int | None = Field(default=None, ge=0, le=8)

    model_config = ConfigDict(str_strip_whitespace=True)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    price: Money | None = None
    stock_quantity: StockQuantity | None = None
    is_active: bool | None = None

    category: str | None = Field(default=None, pattern="^(padaria|frios|bebidas|outros)$")
    product_type: str | None = Field(default=None, pattern="^(manufactured|resale)$")
    unit_of_measure: str | None = Field(default=None, pattern="^(unit|kg|g)$")

    cost_price: Money | None = None
    min_stock_quantity: StockQuantity | None = None

    perishable: bool | None = None
    shelf_life_days: int | None = Field(default=None, gt=0)

    barcode: str | None = Field(default=None, max_length=50)

    ncm_code: str | None = Field(default=None, pattern=r"^\d{8}$")
    cest_code: str | None = Field(default=None, pattern=r"^\d{7}$")
    fiscal_origin: int | None = Field(default=None, ge=0, le=8)

    model_config = ConfigDict(str_strip_whitespace=True)


class ProductRead(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: str | None
    price: Money
    stock_quantity: StockQuantity
    is_active: bool
    status: str

    category: str
    product_type: str
    unit_of_measure: str

    cost_price: Money | None
    min_stock_quantity: StockQuantity

    perishable: bool
    shelf_life_days: int | None

    barcode: str | None

    ncm_code: str | None
    cest_code: str | None
    fiscal_origin: int | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)