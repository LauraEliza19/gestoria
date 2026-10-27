import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import FinanceAuditEvent, FinanceCategory, FinanceEntry
from app.repositories import FinanceCategoryRepository, FinanceEntryRepository


class FinanceError(Exception):
    pass


class FinanceCategoryUnavailableError(FinanceError):
    pass


class DuplicateFinanceCategoryError(FinanceError):
    pass


class FinanceEntryConflictError(FinanceError):
    def __init__(self, entry: FinanceEntry, expected_version: int):
        self.entry = entry
        self.expected_version = expected_version
        super().__init__(
            f"O lançamento foi alterado por outra pessoa. "
            f"Você leu a versão {expected_version}, mas a versão atual é {entry.version}."
        )


def validate_finance_category(
    db: Session, organization_id: uuid.UUID, category_id: uuid.UUID
) -> None:
    category = FinanceCategoryRepository.get_for_organization(
        db, category_id, organization_id
    )
    if category is None or not category.is_active:
        raise FinanceCategoryUnavailableError(
            "A categoria não existe ou está inativa nesta empresa."
        )


def _audit(
    db: Session,
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    event_type: str,
    entity_id: uuid.UUID,
    document: dict,
) -> None:
    def serialize(value):
        if isinstance(value, dict):
            return {key: serialize(item) for key, item in value.items()}
        if isinstance(value, (list, tuple)):
            return [serialize(item) for item in value]
        return str(value) if value is not None else None

    db.add(
        FinanceAuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            event_type=event_type,
            entity_id=entity_id,
            document=serialize(document),
        )
    )


def create_category(db, organization_id, actor_id, values):
    try:
        category = FinanceCategoryRepository.create(db, organization_id, values)
        _audit(db, organization_id, actor_id, "category_created", category.id, values)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateFinanceCategoryError(
            "Já existe uma categoria com este nome nesta empresa."
        ) from exc
    return category


def update_category(db, category: FinanceCategory, actor_id, values):
    if not values:
        return category
    try:
        category = FinanceCategoryRepository.update(db, category, values)
        _audit(
            db,
            category.organization_id,
            actor_id,
            "category_updated",
            category.id,
            values,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateFinanceCategoryError(
            "Já existe uma categoria com este nome nesta empresa."
        ) from exc
    return category


def create_entry(db, organization_id, actor_id, values):
    validate_finance_category(db, organization_id, values["category_id"])
    if values.get("status") == "paid" and values.get("paid_at") is None:
        values["paid_at"] = datetime.now(UTC)
    if values.get("status") != "paid":
        values["paid_at"] = None
    try:
        entry = FinanceEntryRepository.create(db, organization_id, values)
        _audit(db, organization_id, actor_id, "entry_created", entry.id, values)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    return entry


def update_entry(db, entry: FinanceEntry, actor_id, values):
    expected_version = values.pop("expected_version")
    if entry.version != expected_version:
        raise FinanceEntryConflictError(entry, expected_version)
    before = {
        field: getattr(entry, field)
        for field in (
            "category_id",
            "description",
            "amount",
            "entry_type",
            "status",
            "transaction_date",
            "paid_at",
            "notes",
        )
    }
    if "category_id" in values:
        validate_finance_category(db, entry.organization_id, values["category_id"])
    if values.get("status") == "paid" and values.get("paid_at") is None:
        values["paid_at"] = datetime.now(UTC)
    if values.get("status") in {"pending", "cancelled"}:
        values["paid_at"] = None
    try:
        values["version"] = entry.version + 1
        entry = FinanceEntryRepository.update(db, entry, values)
        _audit(
            db,
            entry.organization_id,
            actor_id,
            "entry_updated",
            entry.id,
            {"before": before, "after": values, "version": entry.version},
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    return entry
