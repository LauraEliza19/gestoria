import uuid

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import FiscalDocumentRepository
from app.schemas import FiscalDocumentCreate, FiscalDocumentRead, FiscalDocumentStatusUpdate

router = APIRouter(prefix="/api/fiscal-documents", tags=["fiscal documents"])


@router.get("", response_model=list[FiscalDocumentRead])
def list_fiscal_documents(
    db: DatabaseSession,
    current: CurrentUser,
    document_type: str | None = Query(default=None, pattern="^(saida|entrada)$"),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
) -> list[FiscalDocumentRead]:
    return FiscalDocumentRepository.list_for_organization(db, current.organization.id, document_type=document_type, status=status_filter, search=search)


@router.post("", response_model=FiscalDocumentRead, status_code=status.HTTP_201_CREATED)
def create_fiscal_document(payload: FiscalDocumentCreate, db: DatabaseSession, current: CurrentUser) -> FiscalDocumentRead:
    require_role(current, {"owner", "admin"})
    try:
        return FiscalDocumentRepository.create(db, current.organization.id, payload.model_dump())
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Já existe um documento fiscal com essa chave de acesso.") from exc


@router.patch("/{document_id}", response_model=FiscalDocumentRead)
def update_fiscal_document_status(document_id: uuid.UUID, payload: FiscalDocumentStatusUpdate, db: DatabaseSession, current: CurrentUser) -> FiscalDocumentRead:
    require_role(current, {"owner", "admin"})
    document = FiscalDocumentRepository.get_for_organization(db, document_id, current.organization.id)
    if not document:
        raise HTTPException(status_code=404, detail="Documento fiscal não encontrado.")
    return FiscalDocumentRepository.update_status(db, document, payload.status)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fiscal_document(document_id: uuid.UUID, db: DatabaseSession, current: CurrentUser) -> Response:
    require_role(current, {"owner", "admin"})
    document = FiscalDocumentRepository.get_for_organization(db, document_id, current.organization.id)
    if not document:
        raise HTTPException(status_code=404, detail="Documento fiscal não encontrado.")
    FiscalDocumentRepository.delete(db, document)
    return Response(status_code=204)