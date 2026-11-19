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


def _only_digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def is_valid_cpf(value: str) -> bool:
    digits = _only_digits(value)
    if len(digits) != 11 or len(set(digits)) == 1:
        return False
    for length in (9, 10):
        total = sum(
            int(digit) * (length + 1 - index)
            for index, digit in enumerate(digits[:length])
        )
        if (total * 10) % 11 % 10 != int(digits[length]):
            return False
    return True


def is_valid_cnpj(value: str) -> bool:
    digits = _only_digits(value)
    if len(digits) != 14 or len(set(digits)) == 1:
        return False
    for length in (12, 13):
        weights = [*range(length - 7, 1, -1), *range(9, 1, -1)]
        remainder = (
            sum(int(digit) * weight for digit, weight in zip(digits[:length], weights))
            % 11
        )
        if (0 if remainder < 2 else 11 - remainder) != int(digits[length]):
            return False
    return True


def validate_tax_document(value: str | None) -> str | None:
    """Confere os dígitos verificadores de CPF/CNPJ, com ou sem máscara.

    Mantém o texto como foi digitado; vazio vira None. É a mesma regra que a
    tela fiscal já aplicava antes de emitir a nota.
    """
    if value is None or not value.strip():
        return None
    digits = _only_digits(value)
    if len(digits) == 11:
        if not is_valid_cpf(digits):
            raise ValueError("CPF inválido. Confira os números digitados.")
    elif len(digits) == 14:
        if not is_valid_cnpj(digits):
            raise ValueError("CNPJ inválido. Confira os números digitados.")
    else:
        raise ValueError(
            f"CPF/CNPJ com {len(digits)} dígitos. O CPF tem 11 dígitos e o CNPJ tem 14."
        )
    return value.strip()


def document_matches_person_type(document: str | None, person_type: str | None):
    """Pessoa física usa CPF e pessoa jurídica usa CNPJ."""
    if not document or not person_type:
        return
    digits = _only_digits(document)
    if person_type == "individual" and len(digits) == 14:
        raise ValueError(
            "Para CNPJ, escolha o tipo de pessoa jurídica. Pessoa física usa CPF."
        )
    if person_type == "company" and len(digits) == 11:
        raise ValueError(
            "Para CPF, escolha o tipo de pessoa física. Pessoa jurídica usa CNPJ."
        )
