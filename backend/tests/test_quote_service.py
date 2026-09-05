from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization

#from app.repositories import CustomerRepository, ProductRepository
from app.repositories import (
    CustomerRepository,
    OrderRepository,
    ProductRepository,
    QuoteRepository,
)
from app.schemas import QuoteItemCreate
from app.services import (
    QuoteNotConvertibleError,
    convert_quote_to_order,
    create_quote,
    update_quote_status,
)
from app.services.quotes import business_today


def test_pending_quote_cannot_be_converted(db: Session) -> None:
    organization = db.scalar(
        select(Organization).where(Organization.slug == "empresa-a")
    )
    assert organization is not None

    customer = CustomerRepository.create(
        db,
        organization.id,
        {
            "name": "Cliente Orçamento",
            "phone": "35977775555",
        },
    )

    product = ProductRepository.create(
        db,
        organization.id,
        {
            "name": "Produto Orçado",
            "price": Decimal("25.00"),
            "stock_quantity": Decimal(10),
            "is_active": True,
        },
    )

    quote = create_quote(
        db,
        organization.id,
        customer.id,
        business_today() + timedelta(days=7),
        [
            QuoteItemCreate(
                product_id=product.id,
                quantity=Decimal(2),
            )
        ],
    )

    assert quote.status == "pending"

    with pytest.raises(QuoteNotConvertibleError) as captured:
        convert_quote_to_order(db, quote)

    assert captured.value.current_status == "pending"
    assert "status atual: 'pending'" in str(captured.value)

def test_create_quote_freezes_price_without_changing_stock(db: Session) -> None:
    organization = db.scalar(
        select(Organization).where(Organization.slug == "empresa-a")
    )
    assert organization is not None

    customer = CustomerRepository.create(
        db,
        organization.id,
        {
            "name": "Cliente Preço Congelado",
            "phone": "35966664444",
        },
    )

    product = ProductRepository.create(
        db,
        organization.id,
        {
            "name": "Produto com Preço Histórico",
            "price": Decimal("12.50"),
            "stock_quantity": Decimal(5),
            "is_active": True,
        },
    )

    valid_until = business_today() + timedelta(days=7)

    quote = create_quote(
        db,
        organization.id,
        customer.id,
        valid_until,
        [
            QuoteItemCreate(
                product_id=product.id,
                quantity=Decimal(2),
            )
        ],
    )

    db.refresh(product)

    assert quote.status == "pending"
    assert quote.valid_until == valid_until
    assert quote.total_amount == Decimal("25.00")
    assert len(quote.items) == 1
    assert quote.items[0].quantity == Decimal(2)
    assert quote.items[0].unit_price == Decimal("12.50")
    assert product.stock_quantity == Decimal(5)

    product.price = Decimal("20.00")
    db.commit()
    db.refresh(quote.items[0])

    assert quote.items[0].unit_price == Decimal("12.50")
    assert quote.total_amount == Decimal("25.00")


def test_quote_conversion_uses_frozen_price(db: Session) -> None:
    organization = db.scalar(
        select(Organization).where(Organization.slug == "empresa-a")
    )
    assert organization is not None

    customer = CustomerRepository.create(
        db,
        organization.id,
        {
            "name": "Cliente Conversão",
            "phone": "35955553333",
        },
    )

    product = ProductRepository.create(
        db,
        organization.id,
        {
            "name": "Produto Convertido",
            "price": Decimal("12.50"),
            "stock_quantity": Decimal(5),
            "is_active": True,
        },
    )

    quote = create_quote(
        db,
        organization.id,
        customer.id,
        business_today() + timedelta(days=7),
        [
            QuoteItemCreate(
                product_id=product.id,
                quantity=Decimal(2),
            )
        ],
    )

    update_quote_status(db, quote, "approved")

    # O preço do produto muda depois que o orçamento foi aprovado.
    product.price = Decimal("20.00")
    db.commit()

    converted_quote = convert_quote_to_order(db, quote)

    assert converted_quote.status == "converted"
    assert converted_quote.converted_order_id is not None

    order = OrderRepository.get_for_organization(
        db,
        converted_quote.converted_order_id,
        organization.id,
    )
    assert order is not None

    # O pedido deve manter o preço apresentado no orçamento.
    assert order.total_amount == Decimal("25.00")
    assert len(order.items) == 1
    assert order.items[0].unit_price == Decimal("12.50")

    db.refresh(product)
    assert product.stock_quantity == Decimal(3)

def test_quote_conversion_rolls_back_if_marking_fails(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
    ) -> None:
    organization = db.scalar(
        select(Organization).where(Organization.slug == "empresa-a")
    )
    assert organization is not None

    customer = CustomerRepository.create(
        db,
        organization.id,
        {
            "name": "Cliente Transação",
            "phone": "35944442222",
        },
    )

    product = ProductRepository.create(
        db,
        organization.id,
        {
            "name": "Produto Transacional",
            "price": Decimal("15.00"),
            "stock_quantity": Decimal(5),
            "is_active": True,
        },
    )

    quote = create_quote(
        db,
        organization.id,
        customer.id,
        business_today() + timedelta(days=7),
        [
            QuoteItemCreate(
                product_id=product.id,
                quantity=Decimal(2),
            )
        ],
    )
    update_quote_status(db, quote, "approved")

    def fail_when_marking_converted(
        _db: Session,
        _quote,
        _order_id,
        *,
        commit: bool = True,
    ) -> None:
        assert commit is False
        raise RuntimeError("Falha simulada ao marcar o orçamento")

    monkeypatch.setattr(
        QuoteRepository,
        "mark_converted",
        fail_when_marking_converted,
    )

    with pytest.raises(RuntimeError, match="Falha simulada"):
        convert_quote_to_order(db, quote)

    db.expire_all()

    orders = OrderRepository.list_for_organization(db, organization.id)
    assert orders == []

    db.refresh(product)
    assert product.stock_quantity == Decimal(5)

    db.refresh(quote)
    assert quote.status == "approved"
    assert quote.converted_order_id is None


def test_quote_cannot_be_converted_twice(db: Session) -> None:
    organization = db.scalar(
        select(Organization).where(Organization.slug == "empresa-a")
    )
    assert organization is not None

    customer = CustomerRepository.create(
        db,
        organization.id,
        {
            "name": "Cliente Conversão única",
            "phone": "35933331111",
        },
    )

    product = ProductRepository.create(
        db,
        organization.id,
        {
            "name": "Produto Conversão Única",
            "price": Decimal("10.00"),
            "stock_quantity": Decimal(5),
            "is_active": True,
        },
    )

    quote = create_quote(
        db,
        organization.id,
        customer.id,
        business_today() + timedelta(days=7),
        [
            QuoteItemCreate(
                product_id=product.id,
                quantity=Decimal(2),
            )
        ],
    )
    update_quote_status(db, quote, "approved")

    converted_quote = convert_quote_to_order(db, quote)
    first_order_id = converted_quote.converted_order_id

    assert first_order_id is not None

    with pytest.raises(QuoteNotConvertibleError) as captured:
        convert_quote_to_order(db, quote)

    assert captured.value.current_status == "converted"

    db.expire_all()

    orders = OrderRepository.list_for_organization(db, organization.id)
    assert len(orders) == 1
    assert orders[0].id == first_order_id

    db.refresh(product)
    assert product.stock_quantity == Decimal(3)

    db.refresh(quote)
    assert quote.status == "converted"
    assert quote.converted_order_id == first_order_id