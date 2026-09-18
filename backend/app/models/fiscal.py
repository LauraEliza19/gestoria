"""Fiscal registry with immutable business snapshots and tenant-scoped links."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models import TimestampMixin

ACTIVE_OUTGOING = "document_type = 'saida' AND order_id IS NOT NULL AND status IN ('Autorizada', 'Em processamento')"


class Supplier(Base, TimestampMixin):
    __tablename__ = "suppliers"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_suppliers_org_id"),
        UniqueConstraint(
            "organization_id", "document", name="uq_suppliers_org_document"
        ),
        Index("ix_suppliers_org_name", "organization_id", "name"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    document: Mapped[str] = mapped_column(String(18), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class FiscalDocument(Base, TimestampMixin):
    __tablename__ = "fiscal_documents"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_fiscal_documents_org_id"),
        UniqueConstraint(
            "organization_id", "access_key", name="uq_fiscal_org_access_key"
        ),
        ForeignKeyConstraint(
            ["organization_id", "order_id"],
            ["orders.organization_id", "orders.id"],
            name="fk_fiscal_order_org",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["organization_id", "customer_id"],
            ["customers.organization_id", "customers.id"],
            name="fk_fiscal_customer_org",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["organization_id", "supplier_id"],
            ["suppliers.organization_id", "suppliers.id"],
            name="fk_fiscal_supplier_org",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "document_type IN ('saida', 'entrada')", name="ck_fiscal_document_type"
        ),
        CheckConstraint(
            "model IN ('55', '65', 'NFS-e')", name="ck_fiscal_document_model"
        ),
        CheckConstraint(
            "status IN ('Autorizada', 'Em processamento', 'Cancelada', 'Rejeitada', 'Inutilizada', 'Denegada')",
            name="ck_fiscal_document_status",
        ),
        CheckConstraint("value >= 0", name="ck_fiscal_document_value_nonnegative"),
        CheckConstraint(
            "(document_type = 'entrada' AND order_id IS NULL AND customer_id IS NULL) OR (document_type = 'saida' AND supplier_id IS NULL)",
            name="ck_fiscal_direction_links",
        ),
        CheckConstraint(
            "is_legacy OR (created_by_id IS NOT NULL AND updated_by_id IS NOT NULL AND ((document_type = 'saida' AND order_id IS NOT NULL AND customer_id IS NOT NULL) OR (document_type = 'entrada' AND supplier_id IS NOT NULL)))",
            name="ck_fiscal_required_links",
        ),
        CheckConstraint(
            "is_legacy OR status != 'Autorizada' OR (authorized_at IS NOT NULL AND authorization_protocol IS NOT NULL)",
            name="ck_fiscal_authorization_evidence",
        ),
        CheckConstraint(
            "is_legacy OR status != 'Cancelada' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)",
            name="ck_fiscal_cancellation_evidence",
        ),
        CheckConstraint(
            "authorized_at IS NULL OR cancelled_at IS NULL OR cancelled_at >= authorized_at",
            name="ck_fiscal_dates_order",
        ),
        Index("ix_fiscal_documents_org_date", "organization_id", "issue_date"),
        Index(
            "ix_fiscal_documents_org_type_status",
            "organization_id",
            "document_type",
            "status",
        ),
        Index("ix_fiscal_org_order", "organization_id", "order_id"),
        Index("ix_fiscal_org_status", "organization_id", "status"),
        Index("ix_fiscal_org_number", "organization_id", "number"),
        Index(
            "uq_fiscal_active_order",
            "organization_id",
            "order_id",
            unique=True,
            postgresql_where=text(ACTIVE_OUTGOING),
            sqlite_where=text(ACTIVE_OUTGOING),
        ),
        Index(
            "uq_fiscal_outgoing_number",
            "organization_id",
            "model",
            "series",
            "number",
            unique=True,
            postgresql_where=text("document_type = 'saida'"),
            sqlite_where=text("document_type = 'saida'"),
        ),
        Index(
            "uq_fiscal_incoming_number",
            "organization_id",
            "supplier_id",
            "model",
            "series",
            "number",
            unique=True,
            postgresql_where=text(
                "document_type = 'entrada' AND supplier_id IS NOT NULL"
            ),
            sqlite_where=text("document_type = 'entrada' AND supplier_id IS NOT NULL"),
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "organizations.id", name="fk_fiscal_organization", ondelete="RESTRICT"
        ),
        nullable=False,
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="fk_fiscal_created_by_id", ondelete="RESTRICT"),
    )
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="fk_fiscal_updated_by_id", ondelete="RESTRICT"),
    )
    document_type: Mapped[str] = mapped_column(String(10), nullable=False)
    number: Mapped[str] = mapped_column(String(30), nullable=False)
    series: Mapped[str] = mapped_column(String(20), nullable=False, default="1")
    model: Mapped[str] = mapped_column(String(10), nullable=False, default="55")
    participant_name: Mapped[str] = mapped_column(String(160), nullable=False)
    participant_document: Mapped[str | None] = mapped_column(String(18))
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    cfop: Mapped[str | None] = mapped_column(String(10))
    operation_nature: Mapped[str | None] = mapped_column(String(160))
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="Em processamento"
    )
    access_key: Mapped[str | None] = mapped_column(String(44))
    xml_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pdf_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    authorized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    authorization_protocol: Mapped[str | None] = mapped_column(String(120))
    cancellation_protocol: Mapped[str | None] = mapped_column(String(120))
    cancellation_reason: Mapped[str | None] = mapped_column(String(500))
    is_legacy: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    snapshot_source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="legacy_unverified",
        server_default="legacy_unverified",
    )
    reconciled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stock_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    items: Mapped[list["FiscalDocumentItem"]] = relationship(
        back_populates="document",
        cascade="save-update, merge",
        passive_deletes="all",
        order_by="FiscalDocumentItem.created_at, FiscalDocumentItem.id",
    )
    events: Mapped[list["FiscalEvent"]] = relationship(
        cascade="save-update, merge",
        passive_deletes="all",
        order_by="FiscalEvent.created_at, FiscalEvent.id",
    )


class FiscalDocumentItem(Base):
    __tablename__ = "fiscal_document_items"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_fiscal_items_org_id"),
        ForeignKeyConstraint(
            ["organization_id", "document_id"],
            ["fiscal_documents.organization_id", "fiscal_documents.id"],
            ondelete="RESTRICT",
            name="fk_fiscal_item_document_org",
        ),
        ForeignKeyConstraint(
            ["organization_id", "product_id"],
            ["products.organization_id", "products.id"],
            ondelete="RESTRICT",
            name="fk_fiscal_item_product_org",
        ),
        CheckConstraint(
            "quantity > 0 AND unit_price >= 0 AND total >= 0",
            name="ck_fiscal_item_values",
        ),
        Index("ix_fiscal_items_org_document", "organization_id", "document_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    product_name: Mapped[str] = mapped_column(String(160), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 5), nullable=False)
    fiscal_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    document: Mapped[FiscalDocument] = relationship(back_populates="items")


class FiscalEvent(Base):
    __tablename__ = "fiscal_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "document_id"],
            ["fiscal_documents.organization_id", "fiscal_documents.id"],
            ondelete="RESTRICT",
            name="fk_fiscal_event_document_org",
        ),
        Index("ix_fiscal_events_org_document", "organization_id", "document_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    actor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    detail: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class FiscalStockMovement(Base):
    __tablename__ = "fiscal_stock_movements"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "document_id"],
            ["fiscal_documents.organization_id", "fiscal_documents.id"],
            ondelete="RESTRICT",
            name="fk_fiscal_stock_document_org",
        ),
        ForeignKeyConstraint(
            ["organization_id", "item_id"],
            ["fiscal_document_items.organization_id", "fiscal_document_items.id"],
            ondelete="RESTRICT",
            name="fk_fiscal_stock_item_org",
        ),
        ForeignKeyConstraint(
            ["organization_id", "product_id"],
            ["products.organization_id", "products.id"],
            ondelete="RESTRICT",
            name="fk_fiscal_stock_product_org",
        ),
        UniqueConstraint("item_id", "movement_type", name="uq_fiscal_stock_item_type"),
        CheckConstraint(
            "(movement_type = 'receipt' AND quantity > 0) OR (movement_type = 'reversal' AND quantity < 0)",
            name="ck_fiscal_stock_sign",
        ),
        Index("ix_fiscal_stock_org_document", "organization_id", "document_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    actor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    movement_type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
