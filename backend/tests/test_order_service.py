import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization
from app.repositories import CustomerRepository, OrderRepository, ProductRepository
from app.schemas import OrderItemCreate
from app.services import (
    CustomerNotFoundError,
    InsufficientStockError,
    ProductNotFoundError,
    create_order,
    delete_order_record,
    update_order_status,
)


def _organization_a(db: Session) -> Organization:
    organization = db.scalar(
        select(Organization).where(Organization.slug == "empresa-a")
    )
    assert organization is not None
    return organization


def _customer(db: Session, organization_id, phone: str = "35988887777"):
    return CustomerRepository.create(
        db, organization_id, {"name": "Cliente Pedido", "phone": phone}
    )


def _product(db: Session, organization_id, name: str = "Café", stock: int = 5):
    return ProductRepository.create(
        db,
        organization_id,
        {
            "name": name,
            "price": Decimal("12.50"),
            "stock_quantity": stock,
            "is_active": True,
        },
    )


def test_create_order_decrements_stock_and_sums_duplicate_items(db: Session) -> None:
    organization = _organization_a(db)
    customer = _customer(db, organization.id)
    product = _product(db, organization.id)

    order = create_order(
        db,
        organization.id,
        customer.id,
        [
            OrderItemCreate(product_id=product.id, quantity=2),
            OrderItemCreate(product_id=product.id, quantity=1),
        ],
    )

    db.refresh(product)
    assert order.total_amount == Decimal("37.50")
    assert product.stock_quantity == 2
    assert len(order.items) == 1
    assert order.items[0].quantity == 3
    assert order.items[0].unit_price == Decimal("12.50")


def test_create_order_raises_when_customer_is_missing_or_inactive(
    db: Session,
) -> None:
    organization = _organization_a(db)
    product = _product(db, organization.id)
    items = [OrderItemCreate(product_id=product.id, quantity=1)]

    with pytest.raises(CustomerNotFoundError):
        create_order(db, organization.id, uuid.uuid4(), items)

    customer = _customer(db, organization.id)
    customer.is_active = False
    db.commit()

    with pytest.raises(CustomerNotFoundError):
        create_order(db, organization.id, customer.id, items)


def test_create_order_raises_when_product_is_missing_or_inactive(
    db: Session,
) -> None:
    organization = _organization_a(db)
    customer = _customer(db, organization.id)

    with pytest.raises(ProductNotFoundError):
        create_order(
            db,
            organization.id,
            customer.id,
            [OrderItemCreate(product_id=uuid.uuid4(), quantity=1)],
        )

    product = _product(db, organization.id, name="Inativo")
    product.is_active = False
    db.commit()

    with pytest.raises(ProductNotFoundError):
        create_order(
            db,
            organization.id,
            customer.id,
            [OrderItemCreate(product_id=product.id, quantity=1)],
        )


def test_create_order_rolls_back_when_stock_is_insufficient(db: Session) -> None:
    organization = _organization_a(db)
    customer = _customer(db, organization.id)
    product = _product(db, organization.id, stock=1)

    with pytest.raises(InsufficientStockError) as exc:
        create_order(
            db,
            organization.id,
            customer.id,
            [OrderItemCreate(product_id=product.id, quantity=2)],
        )

    db.refresh(product)
    assert product.stock_quantity == 1
    assert OrderRepository.list_for_organization(db, organization.id) == []
    assert "Última unidade" not in str(exc.value)
    assert "disponível 1.000, solicitado 2" in str(exc.value)
    assert exc.value.product_name == "Café"


def test_update_order_status_restores_and_revalidates_stock(db: Session) -> None:
    organization = _organization_a(db)
    customer = _customer(db, organization.id)
    product = _product(db, organization.id, stock=3)
    order = create_order(
        db,
        organization.id,
        customer.id,
        [OrderItemCreate(product_id=product.id, quantity=2)],
    )

    unchanged = update_order_status(db, order, "in_preparation")
    assert unchanged.status == "in_preparation"

    cancelled = update_order_status(db, order, "cancelled")
    db.refresh(product)
    assert cancelled.status == "cancelled"
    assert product.stock_quantity == 3

    reactivated = update_order_status(
        db,
        cancelled,
        "in_preparation",
    )
    db.refresh(product)
    assert reactivated.status == "in_preparation"
    assert product.stock_quantity == 1

    completed = update_order_status(
        db,
        reactivated,
        "completed",
    )
    db.refresh(product)
    assert completed.status == "completed"
    assert product.stock_quantity == 1


def test_update_order_status_blocks_reactivation_without_stock(db: Session) -> None:
    organization = _organization_a(db)
    customer = _customer(db, organization.id)
    product = _product(db, organization.id, stock=2)
    order = create_order(
        db,
        organization.id,
        customer.id,
        [OrderItemCreate(product_id=product.id, quantity=2)],
    )
    update_order_status(db, order, "cancelled")

    leftover = _product(db, organization.id, name="Outro", stock=2)
    create_order(
        db,
        organization.id,
        customer.id,
        [OrderItemCreate(product_id=product.id, quantity=2)],
    )
    db.refresh(product)
    assert product.stock_quantity == 0

    with pytest.raises(InsufficientStockError):
        update_order_status(db, order, "in_preparation")

    db.refresh(product)
    assert product.stock_quantity == 0
    assert leftover.stock_quantity == 2


def test_delete_order_restores_stock_unless_already_cancelled(db: Session) -> None:
    organization = _organization_a(db)
    customer = _customer(db, organization.id, phone="35911112222")
    product = _product(db, organization.id, name="Pão", stock=4)
    order = create_order(
        db,
        organization.id,
        customer.id,
        [OrderItemCreate(product_id=product.id, quantity=3)],
    )

    delete_order_record(db, order)
    db.refresh(product)
    assert product.stock_quantity == 4
    assert OrderRepository.list_for_organization(db, organization.id) == []

    order = create_order(
        db,
        organization.id,
        customer.id,
        [OrderItemCreate(product_id=product.id, quantity=1)],
    )
    update_order_status(db, order, "cancelled")
    db.refresh(product)
    assert product.stock_quantity == 4

    delete_order_record(db, order)
    db.refresh(product)
    assert product.stock_quantity == 4

def test_cancelling_order_rolls_back_stock_if_status_update_fails(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    organization = _organization_a(db)
    customer = _customer(
        db,
        organization.id,
        phone="35955556666",
    )
    product = _product(
        db,
        organization.id,
        name="Produto Rollback Cancelamento",
        stock=5,
    )

    order = create_order(
        db,
        organization.id,
        customer.id,
        [
            OrderItemCreate(
                product_id=product.id,
                quantity=2,
            )
        ],
    )

    db.refresh(product)
    assert product.stock_quantity == Decimal(3)
    assert order.status == "in_preparation"

    def fail_when_updating_status(
        _db: Session,
        _order,
        status: str,
    ) -> None:
        assert status == "cancelled"
        raise RuntimeError("Falha simulada ao atualizar o pedido")

    monkeypatch.setattr(
        OrderRepository,
        "update_status",
        fail_when_updating_status,
    )

    with pytest.raises(RuntimeError, match="Falha simulada"):
        update_order_status(db, order, "cancelled")

    db.expire_all()
    db.refresh(product)
    db.refresh(order)

    assert product.stock_quantity == Decimal(3)
    assert order.status == "in_preparation"

def test_deleting_order_rolls_back_stock_if_deletion_fails(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    organization = _organization_a(db)
    customer = _customer(
        db,
        organization.id,
        phone="35966667777",
    )
    product = _product(
        db,
        organization.id,
        name="Produto Rollback Exclusão",
        stock=5,
    )

    order = create_order(
        db,
        organization.id,
        customer.id,
        [
            OrderItemCreate(
                product_id=product.id,
                quantity=2,
            )
        ],
    )
    order_id = order.id

    db.refresh(product)
    assert product.stock_quantity == Decimal(3)

    def fail_when_deleting_order(
        _db: Session,
        _order,
    ) -> None:
        raise RuntimeError("Falha simulada ao excluir o pedido")

    monkeypatch.setattr(
        OrderRepository,
        "delete",
        fail_when_deleting_order,
    )

    with pytest.raises(RuntimeError, match="Falha simulada"):
        delete_order_record(db, order)

    db.expire_all()
    db.refresh(product)

    assert product.stock_quantity == Decimal(3)

    orders = OrderRepository.list_for_organization(
        db,
        organization.id,
    )
    assert len(orders) == 1
    assert orders[0].id == order_id
