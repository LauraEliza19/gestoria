import uuid
from decimal import Decimal

import pytest

from app.models import Product


@pytest.mark.parametrize(
    ("is_active", "stock_quantity", "expected"),
    [
        (False, 20, "Inativo"),
        (True, 0, "Esgotado"),
        (True, 1, "Estoque baixo"),
        (True, 5, "Estoque baixo"),
        (True, 6, "Disponível"),
    ],
)
def test_product_status_is_derived_from_stock_and_active_flag(
    is_active: bool, stock_quantity: int, expected: str
) -> None:
    product = Product(
        organization_id=uuid.uuid4(),
        name="Café",
        price=Decimal("12.50"),
        stock_quantity=stock_quantity,
        is_active=is_active,
    )

    assert product.status == expected
