import re
from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: int = Field(ge=0)
    has_next: bool

Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]

StockQuantity = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=3)]
ItemQuantity = Annotated[
    Decimal, Field(gt=0, le=1_000_000, max_digits=10, decimal_places=3)
]


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if not 10 <= len(digits) <= 15:
        raise ValueError("O telefone deve conter entre 10 e 15 dígitos.")
    return digits
