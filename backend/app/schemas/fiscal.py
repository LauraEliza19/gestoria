import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

FiscalStatus = Literal[
    "Autorizada",
    "Em processamento",
    "Cancelada",
    "Rejeitada",
    "Inutilizada",
    "Denegada",
]
FISCAL_STATUSES = (
    "Autorizada",
    "Em processamento",
    "Cancelada",
    "Rejeitada",
    "Inutilizada",
    "Denegada",
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class IncomingItemCreate(StrictModel):
    product_id: uuid.UUID
    quantity: Decimal = Field(gt=0, le=1000000, decimal_places=3, allow_inf_nan=False)
    unit_price: Decimal = Field(
        ge=0, le=9999999999.99, decimal_places=2, allow_inf_nan=False
    )


class FiscalDocumentCreate(StrictModel):
    document_type: Literal["saida", "entrada"]
    number: str = Field(min_length=1, max_length=30)
    series: str = Field(default="1", min_length=1, max_length=20)
    model: Literal["55", "65", "NFS-e"] = "55"
    issue_date: date
    cfop: str | None = Field(default=None, max_length=10)
    operation_nature: str | None = Field(default=None, max_length=160)
    access_key: str | None = Field(default=None, pattern=r"^\d{44}$")
    order_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    items: list[IncomingItemCreate] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_links(self):
        if self.document_type == "saida":
            if not self.order_id or self.supplier_id or self.items:
                raise ValueError(
                    "Saída exige pedido; destinatário, itens e valores vêm do servidor."
                )
        elif self.order_id or not self.supplier_id or not self.items:
            raise ValueError(
                "Entrada exige fornecedor e itens; não aceita pedido de venda."
            )
        return self


class FiscalItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    unit_of_measure: str
    quantity: Decimal
    unit_price: Decimal
    total: Decimal
    fiscal_snapshot: dict


class FiscalEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    actor_id: uuid.UUID
    action: str
    detail: dict
    created_at: datetime


class FiscalDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    document_type: str
    number: str
    series: str
    model: str
    participant_name: str
    participant_document: str | None
    issue_date: date
    cfop: str | None
    operation_nature: str | None
    value: Decimal
    status: str
    access_key: str | None
    xml_available: bool
    pdf_available: bool
    order_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    supplier_id: uuid.UUID | None
    created_by_id: uuid.UUID | None
    updated_by_id: uuid.UUID | None
    authorized_at: datetime | None
    cancelled_at: datetime | None
    authorization_protocol: str | None
    cancellation_protocol: str | None
    cancellation_reason: str | None
    is_legacy: bool
    snapshot_source: str
    reconciled_at: datetime | None
    stock_received_at: datetime | None
    created_at: datetime
    updated_at: datetime
    items: list[FiscalItemRead]
    events: list[FiscalEventRead]
    allowed_statuses: list[str] = Field(default_factory=list)


class FiscalDocumentStatusUpdate(StrictModel):
    status: FiscalStatus
    occurred_at: AwareDatetime | None = None
    protocol: str | None = Field(default=None, min_length=1, max_length=120)
    reason: str | None = Field(default=None, min_length=3, max_length=500)
    access_key: str | None = Field(default=None, pattern=r"^\d{44}$")

    @model_validator(mode="after")
    def validate_evidence(self):
        if self.status == "Autorizada" and (not self.occurred_at or not self.protocol):
            raise ValueError("Informe a data e o protocolo da autorização externa.")
        if self.status == "Cancelada" and (not self.occurred_at or not self.reason):
            raise ValueError("Informe data e motivo do cancelamento.")
        return self


class FiscalOrderLink(StrictModel):
    order_id: uuid.UUID
    reason: str = Field(min_length=10, max_length=500)


class SupplierCreate(StrictModel):
    name: str = Field(min_length=1, max_length=160)
    document: str = Field(pattern=r"^(\d{11}|\d{14})$")


class SupplierUpdate(StrictModel):
    is_active: bool


class SupplierRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    document: str
    is_active: bool
