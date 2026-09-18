import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.models import Supplier
from app.repositories import FiscalDocumentRepository
from app.schemas.fiscal import (
    FiscalDocumentCreate,
    FiscalDocumentRead,
    FiscalDocumentStatusUpdate,
    FiscalOrderLink,
    FiscalStatus,
    SupplierCreate,
    SupplierRead,
    SupplierUpdate,
)
from app.services import fiscal as service

router = APIRouter(prefix="/api/fiscal-documents", tags=["fiscal documents"])
supplier_router = APIRouter(prefix="/api/fiscal-suppliers", tags=["fiscal suppliers"])


def write(db, action: Callable):
    try:
        return action()
    except service.FiscalError as exc:
        db.rollback()
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Conflito fiscal: verifique nota ativa do pedido, número/série/modelo, chave de acesso e vínculos dos registros.",
        ) from exc


def find(db, document_id, current):
    document = FiscalDocumentRepository.get_for_organization(
        db, document_id, current.organization.id
    )
    if not document:
        raise HTTPException(status_code=404, detail="Documento fiscal não encontrado.")
    return document


@router.get("", response_model=list[FiscalDocumentRead])
def list_fiscal_documents(
    db: DatabaseSession,
    current: CurrentUser,
    document_type: str | None = Query(default=None, pattern="^(saida|entrada)$"),
    status_filter: Annotated[FiscalStatus | None, Query(alias="status")] = None,
    search: str | None = Query(default=None, max_length=160),
    order_id: uuid.UUID | None = None,
):
    return [
        service.read_document(d)
        for d in FiscalDocumentRepository.list_for_organization(
            db,
            current.organization.id,
            document_type=document_type,
            status=status_filter,
            search=search,
            order_id=order_id,
        )
    ]


@router.get("/{document_id}", response_model=FiscalDocumentRead)
def get_fiscal_document(
    document_id: uuid.UUID, db: DatabaseSession, current: CurrentUser
):
    return service.read_document(find(db, document_id, current))


@router.post("", response_model=FiscalDocumentRead, status_code=201)
def create_fiscal_document(
    payload: FiscalDocumentCreate, db: DatabaseSession, current: CurrentUser
):
    require_role(current, {"owner", "admin"})
    return service.read_document(
        write(db, lambda: service.create_document(db, current, payload))
    )


@router.patch("/{document_id}", response_model=FiscalDocumentRead)
def update_fiscal_document_status(
    document_id: uuid.UUID,
    payload: FiscalDocumentStatusUpdate,
    db: DatabaseSession,
    current: CurrentUser,
):
    require_role(current, {"owner", "admin"})
    return service.read_document(
        write(db, lambda: service.change_status(db, current, document_id, payload))
    )


@router.post("/{document_id}/link-order", response_model=FiscalDocumentRead)
def link_order(
    document_id: uuid.UUID,
    payload: FiscalOrderLink,
    db: DatabaseSession,
    current: CurrentUser,
):
    require_role(current, {"owner", "admin"})
    return service.read_document(
        write(db, lambda: service.link_legacy_order(db, current, document_id, payload))
    )


@router.post("/{document_id}/receive", response_model=FiscalDocumentRead)
def receive(document_id: uuid.UUID, db: DatabaseSession, current: CurrentUser):
    require_role(current, {"owner", "admin"})
    return service.read_document(
        write(db, lambda: service.receive_stock(db, current, document_id))
    )


@router.delete("/{document_id}", status_code=204)
def delete_fiscal_document(
    document_id: uuid.UUID, db: DatabaseSession, current: CurrentUser
) -> Response:
    require_role(current, {"owner", "admin"})
    find(db, document_id, current)
    raise HTTPException(
        status_code=409,
        detail="Registros fiscais não podem ser excluídos. Registre o cancelamento para preservar o histórico.",
    )


@supplier_router.get("", response_model=list[SupplierRead])
def list_suppliers(db: DatabaseSession, current: CurrentUser):
    return list(
        db.scalars(
            select(Supplier)
            .where(Supplier.organization_id == current.organization.id)
            .order_by(Supplier.name)
        )
    )


@supplier_router.post("", response_model=SupplierRead, status_code=201)
def create_supplier(payload: SupplierCreate, db: DatabaseSession, current: CurrentUser):
    require_role(current, {"owner", "admin"})

    def action():
        service.authorize(db, current)
        supplier = Supplier(
            organization_id=current.organization.id, **payload.model_dump()
        )
        db.add(supplier)
        db.commit()
        db.refresh(supplier)
        return supplier

    return write(db, action)


@supplier_router.patch("/{supplier_id}", response_model=SupplierRead)
def update_supplier(
    supplier_id: uuid.UUID,
    payload: SupplierUpdate,
    db: DatabaseSession,
    current: CurrentUser,
):
    require_role(current, {"owner", "admin"})

    def action():
        service.authorize(db, current)
        supplier = db.scalar(
            select(Supplier)
            .where(
                Supplier.id == supplier_id,
                Supplier.organization_id == current.organization.id,
            )
            .with_for_update()
        )
        if not supplier:
            raise service.FiscalError("Fornecedor não encontrado.", 404)
        supplier.is_active = payload.is_active
        db.commit()
        db.refresh(supplier)
        return supplier

    return write(db, action)
