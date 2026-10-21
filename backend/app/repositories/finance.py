import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import FinanceCategory, FinanceEntry


class FinanceCategoryRepository:
    @staticmethod
    def list_for_organization(db: Session, organization_id: uuid.UUID) -> list[FinanceCategory]:
        return list(db.scalars(select(FinanceCategory).where(
            FinanceCategory.organization_id == organization_id
        ).order_by(FinanceCategory.is_active.desc(), FinanceCategory.name)))

    @staticmethod
    def get_for_organization(db: Session, category_id: uuid.UUID, organization_id: uuid.UUID):
        return db.scalar(select(FinanceCategory).where(
            FinanceCategory.id == category_id,
            FinanceCategory.organization_id == organization_id,
        ))

    @staticmethod
    def create(db: Session, organization_id: uuid.UUID, values: dict) -> FinanceCategory:
        category = FinanceCategory(organization_id=organization_id, **values)
        db.add(category)
        db.flush()
        return category

    @staticmethod
    def update(db: Session, category: FinanceCategory, values: dict) -> FinanceCategory:
        for field, value in values.items():
            setattr(category, field, value)
        db.flush()
        return category


class FinanceEntryRepository:
    @staticmethod
    def list_for_organization(db: Session, organization_id: uuid.UUID, **filters) -> list[FinanceEntry]:
        query = select(FinanceEntry).where(FinanceEntry.organization_id == organization_id)
        for field in ("entry_type", "status", "category_id"):
            if filters.get(field) is not None:
                query = query.where(getattr(FinanceEntry, field) == filters[field])
        if filters.get("start_date"):
            query = query.where(FinanceEntry.transaction_date >= filters["start_date"])
        if filters.get("end_date"):
            query = query.where(FinanceEntry.transaction_date <= filters["end_date"])
        return list(db.scalars(query.order_by(FinanceEntry.transaction_date.desc(), FinanceEntry.created_at.desc())))

    @staticmethod
    def get_for_organization(db: Session, entry_id: uuid.UUID, organization_id: uuid.UUID, *, for_update=False):
        query = select(FinanceEntry).where(
            FinanceEntry.id == entry_id,
            FinanceEntry.organization_id == organization_id,
        )
        return db.scalar(query.with_for_update() if for_update else query)

    @staticmethod
    def create(db: Session, organization_id: uuid.UUID, values: dict) -> FinanceEntry:
        entry = FinanceEntry(organization_id=organization_id, **values)
        db.add(entry)
        db.flush()
        return entry

    @staticmethod
    def update(db: Session, entry: FinanceEntry, values: dict) -> FinanceEntry:
        for field, value in values.items():
            setattr(entry, field, value)
        db.flush()
        return entry

    @staticmethod
    def summary(db: Session, organization_id: uuid.UUID, **filters) -> dict[str, Decimal]:
        query = select(FinanceEntry.entry_type, func.coalesce(func.sum(FinanceEntry.amount), 0)).where(
            FinanceEntry.organization_id == organization_id,
            FinanceEntry.status == "paid",
        )
        for field in ("entry_type", "category_id"):
            if filters.get(field) is not None:
                query = query.where(getattr(FinanceEntry, field) == filters[field])
        if filters.get("start_date"):
            query = query.where(FinanceEntry.transaction_date >= filters["start_date"])
        if filters.get("end_date"):
            query = query.where(FinanceEntry.transaction_date <= filters["end_date"])
        rows = db.execute(query.group_by(FinanceEntry.entry_type)).all()
        totals = {kind: Decimal(str(amount)) for kind, amount in rows}
        income = totals.get("income", Decimal(0))
        expense = totals.get("expense", Decimal(0))
        return {"total_income": income, "total_expense": expense, "balance": income - expense}
