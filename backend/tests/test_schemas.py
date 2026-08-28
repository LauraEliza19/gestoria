import uuid

import pytest
from pydantic import ValidationError

from app.schemas import (
    CustomerCreate,
    CustomerUpdate,
    LoginRequest,
    OrderCreate,
    OrderItemCreate,
    OrderStatusUpdate,
    ProductCreate,
    normalize_phone,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("(35) 99999-0000", "35999990000"),
        ("35 99999 0000", "35999990000"),
        ("35999990000", "35999990000"),
        ("5511999998888", "5511999998888"),
    ],
)
def test_normalize_phone_keeps_digits_only(raw: str, expected: str) -> None:
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", ["123", "123456789", "1" * 16, "abcdefghij"])
def test_normalize_phone_rejects_invalid_length(raw: str) -> None:
    with pytest.raises(ValueError, match="entre 10 e 15 dígitos"):
        normalize_phone(raw)


def test_customer_create_normalizes_phone_and_strips_name() -> None:
    customer = CustomerCreate(name="  Maria Souza  ", phone="(35) 98888-7777")

    assert customer.name == "Maria Souza"
    assert customer.phone == "35988887777"


def test_customer_update_skips_phone_when_omitted() -> None:
    update = CustomerUpdate(name="Maria")

    assert update.phone is None
    assert CustomerUpdate(phone="(11) 98888-0000").phone == "11988880000"


def test_product_create_rejects_negative_price_and_blank_name() -> None:
    with pytest.raises(ValidationError):
        ProductCreate(name="Café", price="-1", stock_quantity=1)
    with pytest.raises(ValidationError):
        ProductCreate(name="   ", price="10.00", stock_quantity=1)


def test_order_payload_requires_items_and_positive_quantity() -> None:
    product_id = uuid.uuid4()
    customer_id = uuid.uuid4()

    with pytest.raises(ValidationError):
        OrderCreate(customer_id=customer_id, items=[])
    with pytest.raises(ValidationError):
        OrderItemCreate(product_id=product_id, quantity=0)

    created = OrderCreate(
        customer_id=customer_id,
        items=[OrderItemCreate(product_id=product_id, quantity=2)],
    )
    assert created.items[0].quantity == 2


@pytest.mark.parametrize("status", ["in_preparation", "completed", "cancelled"])
def test_order_status_update_accepts_valid_values(status: str) -> None:
    assert OrderStatusUpdate(status=status).status == status


def test_order_status_update_rejects_unknown_status() -> None:
    with pytest.raises(ValidationError):
        OrderStatusUpdate(status="pending")


def test_login_request_requires_email_and_minimum_password() -> None:
    with pytest.raises(ValidationError):
        LoginRequest(email="nao-e-email", password="SenhaForte@123")
    with pytest.raises(ValidationError):
        LoginRequest(email="admin@gestoria.dev", password="curta")
