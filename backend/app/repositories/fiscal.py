import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import FiscalDocument


class FiscalDocumentRepository:
    @staticmethod
    def list_for_organization(
        db: Session,
        organization_id: uuid.UUID,
        *,
        document_type=None,
        status=None,
        search=None,
        order_id=None,
    ):
        query = (
            select(FiscalDocument)
            .options(
                selectinload(FiscalDocument.items), selectinload(FiscalDocument.events)
            )
            .where(FiscalDocument.organization_id == organization_id)
        )
        if document_type:
            query = query.where(FiscalDocument.document_type == document_type)
        if status:
            query = query.where(FiscalDocument.status == status)
        if order_id:
            query = query.where(FiscalDocument.order_id == order_id)
        if search:
            term = f"%{search}%"
            query = query.where(
                or_(
                    FiscalDocument.participant_name.ilike(term),
                    FiscalDocument.number.ilike(term),
                    FiscalDocument.access_key.ilike(term),
                )
            )
        return list(
            db.scalars(
                query.order_by(
                    FiscalDocument.issue_date.desc(), FiscalDocument.created_at.desc()
                )
            )
        )

    @staticmethod
    def get_for_organization(
        db: Session,
        document_id: uuid.UUID,
        organization_id: uuid.UUID,
        *,
        for_update=False,
    ):
        query = (
            select(FiscalDocument)
            .options(
                selectinload(FiscalDocument.items), selectinload(FiscalDocument.events)
            )
            .where(
                FiscalDocument.id == document_id,
                FiscalDocument.organization_id == organization_id,
            )
        )
        if for_update:
            query = query.with_for_update(of=FiscalDocument).execution_options(
                populate_existing=True
            )
        return db.scalar(query)
