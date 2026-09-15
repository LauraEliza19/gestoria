import uuid

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models import FiscalDocument


class FiscalDocumentRepository:
    @staticmethod
    def list_for_organization(
        db: Session,
        organization_id: uuid.UUID,
        *,
        document_type: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ) -> list[FiscalDocument]:
        query: Select[tuple[FiscalDocument]] = select(FiscalDocument).where(FiscalDocument.organization_id == organization_id)
        if document_type:
            query = query.where(FiscalDocument.document_type == document_type)
        if status:
            query = query.where(FiscalDocument.status == status)
        if search:
            term = f"%{search}%"
            query = query.where((FiscalDocument.participant_name.ilike(term)) | (FiscalDocument.number.ilike(term)) | (FiscalDocument.access_key.ilike(term)))
        return list(db.scalars(query.order_by(FiscalDocument.issue_date.desc(), FiscalDocument.created_at.desc())))

    @staticmethod
    def get_for_organization(db: Session, document_id: uuid.UUID, organization_id: uuid.UUID) -> FiscalDocument | None:
        return db.scalar(select(FiscalDocument).where(FiscalDocument.id == document_id, FiscalDocument.organization_id == organization_id))

    @staticmethod
    def create(db: Session, organization_id: uuid.UUID, payload: dict) -> FiscalDocument:
        document = FiscalDocument(organization_id=organization_id, **payload)
        db.add(document)
        db.commit()
        db.refresh(document)
        return document

    @staticmethod
    def update_status(db: Session, document: FiscalDocument, status: str) -> FiscalDocument:
        document.status = status
        db.commit()
        db.refresh(document)
        return document

    @staticmethod
    def delete(db: Session, document: FiscalDocument) -> None:
        db.delete(document)
        db.commit()