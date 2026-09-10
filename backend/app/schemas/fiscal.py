import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


FISCAL_STATUSES = ("Autorizada", "Em processamento", "Cancelada", "Rejeitada", "Inutilizada", "Denegada")


class FiscalDocumentCreate(BaseModel):
    document_type: str = Field(pattern="^(saida|entrada)$")
    number: str = Field(min_length=1, max_length=30)
    series: str = Field(default="1", max_length=20)
    model: str = Field(default="55", pattern="^(55|65|NFS-e)$")
    participant_name: str = Field(min_length=1, max_length=160)
    participant_document: str | None = Field(default=None, max_length=18)
    issue_date: date
    cfop: str | None = Field(default=None, max_length=10)
    operation_nature: str | None = Field(default=None, max_length=160)
    value: Decimal = Field(default=0, ge=0)
    status: str = Field(default="Em processamento", pattern="^(Autorizada|Em processamento|Cancelada|Rejeitada|Inutilizada|Denegada)$")
    access_key: str | None = Field(default=None, min_length=44, max_length=44)
    xml_available: bool = False
    pdf_available: bool = False
    order_id: uuid.UUID | None = None


class FiscalDocumentRead(FiscalDocumentCreate):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FiscalDocumentStatusUpdate(BaseModel):
    status: str = Field(pattern="^(Autorizada|Em processamento|Cancelada|Rejeitada|Inutilizada|Denegada)$")