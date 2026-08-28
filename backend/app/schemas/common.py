import re
from decimal import Decimal
from typing import Annotated

from pydantic import Field

Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if not 10 <= len(digits) <= 15:
        raise ValueError("O telefone deve conter entre 10 e 15 dígitos.")
    return digits
