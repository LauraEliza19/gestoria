import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import FiscalDocument, Supplier
from app.repositories.pagination import paginate


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


class SupplierRepository:
    @staticmethod
    def list_for_organization(
        db: Session,
        organization_id: uuid.UUID,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
        active_only: bool | None = None,
        sort: str = "name",
    ):
        query = select(Supplier).where(Supplier.organization_id == organization_id)
        if search:
            term = f"%{search}%"
            query = query.where(
                or_(Supplier.name.ilike(term), Supplier.document.ilike(term))
            )
        if active_only is not None:
            query = query.where(Supplier.is_active.is_(active_only))
        query = query.order_by(
            {"name": Supplier.name.asc(), "created_at": Supplier.created_at.desc()}[
                sort
            ],
            Supplier.id,
        )
        return paginate(db, query, page, page_size)
