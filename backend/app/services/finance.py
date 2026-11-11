import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    FinanceAttachment,
    FinanceAuditEvent,
    FinanceCategory,
    FinanceEntry,
)
from app.repositories import FinanceCategoryRepository, FinanceEntryRepository

MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
ALLOWED_ATTACHMENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/xml",
    "text/xml",
}


class FinanceError(Exception):
    pass


class FinanceCategoryUnavailableError(FinanceError):
    pass


class DuplicateFinanceCategoryError(FinanceError):
    pass


class FinanceEntryNotPendingError(FinanceError):
    pass


class FinanceAttachmentError(FinanceError):
    pass


class FinanceAttachmentTooLargeError(FinanceAttachmentError):
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
    if values.get("due_date") is None:
        values["due_date"] = values["transaction_date"]
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
            "due_date",
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


def settle_entry(db, entry: FinanceEntry, actor_id, values):
    """Baixa: registra o pagamento (saída) ou o recebimento (entrada) do título."""
    expected_version = values["expected_version"]
    if entry.version != expected_version:
        raise FinanceEntryConflictError(entry, expected_version)
    if entry.status != "pending":
        raise FinanceEntryNotPendingError(
            "Somente títulos pendentes podem ser baixados."
        )
    before = {"status": entry.status, "paid_at": entry.paid_at}
    after = {"status": "paid", "paid_at": values.get("paid_at") or datetime.now(UTC)}
    try:
        entry = FinanceEntryRepository.update(
            db, entry, {**after, "version": entry.version + 1}
        )
        _audit(
            db,
            entry.organization_id,
            actor_id,
            "entry_settled",
            entry.id,
            {"before": before, "after": after, "version": entry.version},
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    return entry


def add_attachment(
    db,
    entry: FinanceEntry,
    actor_id,
    *,
    file_name: str,
    content_type: str | None,
    content: bytes,
) -> FinanceAttachment:
    normalized_type = (content_type or "").split(";")[0].strip().lower()
    if normalized_type not in ALLOWED_ATTACHMENT_TYPES:
        raise FinanceAttachmentError(
            "Formato não aceito. Envie PDF, PNG, JPEG, WEBP ou XML."
        )
    if not content:
        raise FinanceAttachmentError("O arquivo está vazio.")
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise FinanceAttachmentTooLargeError("O arquivo deve ter no máximo 5 MB.")
    clean_name = file_name.replace("\\", "/").split("/")[-1].strip() or "anexo"
    attachment = FinanceAttachment(
        organization_id=entry.organization_id,
        entry_id=entry.id,
        file_name=clean_name[:255],
        content_type=normalized_type,
        size_bytes=len(content),
        content=content,
        uploaded_by=actor_id,
    )
    try:
        db.add(attachment)
        db.flush()
        _audit(
            db,
            entry.organization_id,
            actor_id,
            "attachment_added",
            entry.id,
            {
                "before": {"attachment": None},
                "after": {"attachment": attachment.file_name},
                "attachment_id": attachment.id,
                "version": entry.version,
            },
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    return attachment


def remove_attachment(db, entry: FinanceEntry, attachment: FinanceAttachment, actor_id):
    document = {
        "before": {"attachment": attachment.file_name},
        "after": {"attachment": None},
        "attachment_id": attachment.id,
        "version": entry.version,
    }
    db.delete(attachment)
    _audit(
        db, entry.organization_id, actor_id, "attachment_removed", entry.id, document
    )
    db.commit()
