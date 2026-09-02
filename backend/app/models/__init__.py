from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Date,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

__all__ = [
    "TimestampMixin",
    "Organization",
    "User",
    "OrganizationMember",
    "Product",
    "Customer",
    "Order",
    "OrderItem",
    "Quote",
    "QuoteItem"
]


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str]  = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ---- Identificação fiscal ----
    document: Mapped[str | None] = mapped_column(String(18))  # CNPJ
    state_registration: Mapped[str | None] = mapped_column(String(30))  # Inscrição Estadual
    municipal_registration: Mapped[str | None] = mapped_column(String(30))  # Código Municipal

    # ---- Contato ----
    phone: Mapped[str | None] = mapped_column(String(30))

    # ---- Endereço estruturado ----
    postal_code: Mapped[str | None] = mapped_column(String(9))   # CEP
    street: Mapped[str | None] = mapped_column(String(160))
    number: Mapped[str | None] = mapped_column(String(20))
    complement: Mapped[str | None] = mapped_column(String(80))
    neighborhood: Mapped[str | None] = mapped_column(String(80))
    city: Mapped[str | None] = mapped_column(String(80))
    state: Mapped[str | None] = mapped_column(String(2))


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        CheckConstraint("role IN ('owner', 'admin', 'member')", name="ck_member_role"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), default="member", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Product(Base, TimestampMixin):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_product_org_name"),
        CheckConstraint("price >= 0", name="ck_product_price_nonnegative"),
        CheckConstraint("stock_quantity >= 0", name="ck_product_stock_nonnegative"),
        Index("ix_products_org_created_at", "organization_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    stock_quantity: Mapped[int] = mapped_column(default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    order_items: Mapped[list[OrderItem]] = relationship(back_populates="product")
    quote_items: Mapped[list[QuoteItem]] = relationship(back_populates="product")

    @property
    def status(self) -> str:
        if not self.is_active:
            return "Inativo"
        if self.stock_quantity == 0:
            return "Esgotado"
        if self.stock_quantity <= 5:
            return "Estoque baixo"
        return "Disponível"


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("organization_id", "phone", name="uq_customer_org_phone"),
        Index("ix_customers_org_created_at", "organization_id", "created_at"),
        Index("ix_customers_org_name", "organization_id", "name"),
        CheckConstraint(
            "person_type IN ('individual', 'company')",
            name="ck_customer_person_type"
        ),
        CheckConstraint(
            "category IN ('final_consumer', 'reseller', 'event')",
            name="ck_customer_category",
        ),
        CheckConstraint(
            "default_discount_percent >= 0 AND default_discount_percent <= 100",
            name="ck_customer_discount_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[int] = mapped_column(String(30), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    person_type: Mapped[str] = mapped_column(
        String(10), default="individual", nullable=False
    )

    document: Mapped[str | None] = mapped_column(String(18)) #cpf or cnpj
    trade_name: Mapped[str| None] = mapped_column(String(120)) #nome fantasia
    state_registration: Mapped[str | None] = mapped_column(String(30)) #inscrição estadual

    #contato
    whatsapp: Mapped[str| None] = mapped_column(String(30))
    email: Mapped[str| None] = mapped_column(String(255))

    #relacionamento comercial 

    birth_date: Mapped[date | None] = mapped_column(Date)
    category: Mapped[str] = mapped_column(
        String(20), default="final_consumer", nullable=False
    )
    default_discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    notes: Mapped[str| None] = mapped_column(String(1000))

    #endereço estruturado

    postal_code: Mapped[str| None] = mapped_column(String(9)) #cep
    street: Mapped[str | None] = mapped_column(String(160)) #rua
    number: Mapped[str | None] = mapped_column(String(20))
    complement: Mapped[str | None] = mapped_column(String(80))
    neighborhood: Mapped[str | None] = mapped_column(String(80))
    city: Mapped[str| None] = mapped_column(String(80))
    state: Mapped[str | None] = mapped_column(String(2))

    orders: Mapped[list[Order]] = relationship(back_populates="customer")
    quotes: Mapped[list[Quote]] = relationship(back_populates="customer")


class Order(Base, TimestampMixin):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('in_preparation', 'completed', 'cancelled')",
            name="ck_order_status",
        ),
        CheckConstraint("total_amount >= 0", name="ck_order_total_nonnegative"),
        Index("ix_orders_org_created_at", "organization_id", "created_at"),
        Index(
            "ix_orders_org_status_created_at",
            "organization_id",
            "status",
            "created_at",
        ),
        Index("ix_orders_org_customer", "organization_id", "customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20), default="in_preparation", nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=0, nullable=False
    )
    customer: Mapped[Customer] = relationship(back_populates="orders")
    items: Mapped[list[OrderItem]] = relationship(
        back_populates="order", cascade="all, delete-orphan", passive_deletes=True
    )


class OrderItem(Base, TimestampMixin):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_item_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_order_item_price_nonnegative"),
        Index("ix_order_items_order_id", "order_id"),
        Index("ix_order_items_product_id", "product_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(back_populates="order_items")

class Quote(Base, TimestampMixin):
    __tablename__ = "quotes"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'converted')",
            name="ck_quote_status",
        ),
        CheckConstraint("total_amount >= 0", name="ck_quote_total_nonnegative"),
        Index("ix_quotes_org_created_at", "organization_id", "created_at"),
        Index(
            "ix_quotes_org_status_created_at",
            "organization_id",
            "status",
            "created_at",
        ),
        Index("ix_quotes_org_customer", "organization_id", "customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    valid_until: Mapped[datetime] = mapped_column(Date, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=0, nullable=False
    )
    converted_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
    )
    customer: Mapped[Customer] = relationship(back_populates="quotes")
    items: Mapped[list[QuoteItem]] = relationship(
        back_populates="quote", cascade="all, delete-orphan", passive_deletes=True
    )


class QuoteItem(Base, TimestampMixin):
    __tablename__ = "quote_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_quote_item_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_quote_item_price_nonnegative"),
        Index("ix_quote_items_quote_id", "quote_id"),
        Index("ix_quote_items_product_id", "product_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    quote_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("quotes.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    quote: Mapped[Quote] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(back_populates="quote_items")