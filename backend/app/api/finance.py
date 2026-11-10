import uuid
from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import String, cast, or_, select

from app.api.dependencies import (
    CurrentUser,
    DatabaseSession,
    require_finance_manage,
    require_finance_read,
)
from app.models import FinanceAuditEvent, FinanceEntry, User
from app.repositories import FinanceCategoryRepository, FinanceEntryRepository
from app.schemas import (
    FinanceAuditSearchPageRead,
    FinanceCategoryCreate,
    FinanceCategoryRead,
    FinanceCategoryUpdate,
    FinanceEntryCreate,
    FinanceEntryHistoryRead,
    FinanceEntryRead,
    FinanceEntryUpdate,
    FinanceSummaryRead,
)
from app.services import (
    DuplicateFinanceCategoryError,
    FinanceCategoryUnavailableError,
    FinanceEntryConflictError,
    create_category,
    create_entry,
    update_category,
    update_entry,
)

router = APIRouter(prefix="/api/finance", tags=["finance"])


def not_found(label: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{label} não encontrado.")


@router.get("/categories", response_model=list[FinanceCategoryRead])
def list_categories(db: DatabaseSession, current: CurrentUser):
    require_finance_read(current)
    return FinanceCategoryRepository.list_for_organization(db, current.organization.id)


@router.post(
    "/categories",
    response_model=FinanceCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_category_route(
    payload: FinanceCategoryCreate, db: DatabaseSession, current: CurrentUser
):
    require_finance_manage(current)
    try:
        return create_category(
            db, current.organization.id, current.user.id, payload.model_dump()
        )
    except DuplicateFinanceCategoryError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/categories/{category_id}", response_model=FinanceCategoryRead)
def get_category(category_id: uuid.UUID, db: DatabaseSession, current: CurrentUser):
    require_finance_read(current)
    category = FinanceCategoryRepository.get_for_organization(
        db, category_id, current.organization.id
    )
    if category is None:
        raise not_found("Categoria")
    return category


@router.patch("/categories/{category_id}", response_model=FinanceCategoryRead)
def update_category_route(
    category_id: uuid.UUID,
    payload: FinanceCategoryUpdate,
    db: DatabaseSession,
    current: CurrentUser,
):
    require_finance_manage(current)
    category = FinanceCategoryRepository.get_for_organization(
        db, category_id, current.organization.id
    )
    if category is None:
        raise not_found("Categoria")
    try:
        return update_category(
            db, category, current.user.id, payload.model_dump(exclude_unset=True)
        )
    except DuplicateFinanceCategoryError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/entries", response_model=list[FinanceEntryRead])
def list_entries(
    db: DatabaseSession,
    current: CurrentUser,
    start_date: date | None = None,
    end_date: date | None = None,
    entry_type: str | None = Query(default=None, pattern="^(income|expense)$"),
    status_filter: str | None = Query(
        default=None, alias="status", pattern="^(pending|paid|cancelled)$"
    ),
    category_id: uuid.UUID | None = None,
):
    require_finance_read(current)
    return FinanceEntryRepository.list_for_organization(
        db,
        current.organization.id,
        start_date=start_date,
        end_date=end_date,
        entry_type=entry_type,
        status=status_filter,
        category_id=category_id,
    )


@router.post(
    "/entries", response_model=FinanceEntryRead, status_code=status.HTTP_201_CREATED
)
def create_entry_route(
    payload: FinanceEntryCreate, db: DatabaseSession, current: CurrentUser
):
    require_finance_manage(current)
    try:
        return create_entry(
            db, current.organization.id, current.user.id, payload.model_dump()
        )
    except FinanceCategoryUnavailableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/audit", response_model=FinanceAuditSearchPageRead)
def search_finance_audit(
    db: DatabaseSession,
    current: CurrentUser,
    query: str | None = Query(default=None, max_length=200),
    actor: str | None = Query(default=None, max_length=120),
    start_date: date | None = None,
    end_date: date | None = None,
    before_value: str | None = Query(default=None, max_length=40),
    after_value: str | None = Query(default=None, max_length=40),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> FinanceAuditSearchPageRead:
    """Pesquisa eventos financeiros e pagina depois de aplicar os filtros."""
    require_finance_read(current)

    statement = (
        select(
            FinanceAuditEvent,
            FinanceEntry.description,
            User.full_name,
        )
        .join(
            FinanceEntry,
            FinanceEntry.id == FinanceAuditEvent.entity_id,
        )
        .join(
            User,
            User.id == FinanceAuditEvent.actor_id,
        )
        .where(
            FinanceAuditEvent.organization_id == current.organization.id,
            FinanceEntry.organization_id == current.organization.id,
            FinanceAuditEvent.event_type.in_(("entry_created", "entry_updated")),
        )
    )

    if query:
        term = f"%{query.strip()}%"
        statement = statement.where(
            or_(
                FinanceEntry.description.ilike(term),
                cast(FinanceEntry.id, String).ilike(term),
            )
        )

    if actor:
        statement = statement.where(User.full_name.ilike(f"%{actor.strip()}%"))

    if start_date:
        statement = statement.where(
            FinanceAuditEvent.created_at
            >= datetime.combine(
                start_date,
                datetime.min.time(),
            )
        )

    if end_date:
        statement = statement.where(
            FinanceAuditEvent.created_at
            <= datetime.combine(
                end_date,
                datetime.max.time(),
            )
        )

    statement = statement.order_by(
        FinanceAuditEvent.created_at.desc(),
        FinanceAuditEvent.id.desc(),
    ).execution_options(yield_per=500)

    normalized_before = (
        before_value.replace(",", ".").casefold() if before_value else None
    )
    normalized_after = after_value.replace(",", ".").casefold() if after_value else None

    page_start = (page - 1) * page_size
    page_end = page_start + page_size

    items: list[dict] = []
    total = 0

    for event, description, actor_name in db.execute(statement):
        document = event.document or {}

        if event.event_type == "entry_created":
            changes = {
                field: {
                    "before": None,
                    "after": value,
                }
                for field, value in document.items()
                if field != "version"
            }
            version = 1
        else:
            before = document.get("before", {})
            after = document.get("after", {})

            changes = {
                field: {
                    "before": before.get(field),
                    "after": value,
                }
                for field, value in after.items()
                if field != "version"
            }
            version = int(document.get("version", 1))

        if normalized_before and not any(
            normalized_before in str(change.get("before") or "").casefold()
            for change in changes.values()
        ):
            continue

        if normalized_after and not any(
            normalized_after in str(change.get("after") or "").casefold()
            for change in changes.values()
        ):
            continue

        if page_start <= total < page_end:
            items.append(
                {
                    "id": event.id,
                    "entry_id": event.entity_id,
                    "entry_description": description,
                    "event_type": event.event_type,
                    "actor_name": actor_name,
                    "created_at": event.created_at,
                    "version": version,
                    "changes": changes,
                }
            )

        total += 1

    return FinanceAuditSearchPageRead(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=page_end < total,
    )


@router.get("/entries/{entry_id}/history", response_model=list[FinanceEntryHistoryRead])
def get_entry_history(entry_id: uuid.UUID, db: DatabaseSession, current: CurrentUser):
    require_finance_read(current)
    entry = FinanceEntryRepository.get_for_organization(
        db, entry_id, current.organization.id
    )
    if entry is None:
        raise not_found("Lançamento")
    events = db.execute(
        select(FinanceAuditEvent, User.full_name)
        .join(User, User.id == FinanceAuditEvent.actor_id)
        .where(
            FinanceAuditEvent.organization_id == current.organization.id,
            FinanceAuditEvent.entity_id == entry_id,
            FinanceAuditEvent.event_type.in_(("entry_created", "entry_updated")),
        )
        .order_by(FinanceAuditEvent.created_at.desc(), FinanceAuditEvent.id.desc())
    ).all()
    result = []
    for event, actor_name in events:
        document = event.document
        if event.event_type == "entry_created":
            changes = {
                field: {"before": None, "after": value}
                for field, value in document.items()
                if field != "version"
            }
            version = 1
        else:
            changes = document.get("after", {})
            before = document.get("before", {})
            changes = {
                field: {"before": before.get(field), "after": value}
                for field, value in changes.items()
                if field != "version"
            }
            version = int(document.get("version", 1))
        result.append(
            {
                "id": event.id,
                "event_type": event.event_type,
                "actor_name": actor_name,
                "created_at": event.created_at,
                "version": version,
                "changes": changes,
            }
        )
    result.sort(key=lambda event: event["version"], reverse=True)
    return result


@router.get("/entries/{entry_id}", response_model=FinanceEntryRead)
def get_entry(entry_id: uuid.UUID, db: DatabaseSession, current: CurrentUser):
    require_finance_read(current)
    entry = FinanceEntryRepository.get_for_organization(
        db, entry_id, current.organization.id
    )
    if entry is None:
        raise not_found("Lançamento")
    return entry


@router.patch("/entries/{entry_id}", response_model=FinanceEntryRead)
def update_entry_route(
    entry_id: uuid.UUID,
    payload: FinanceEntryUpdate,
    db: DatabaseSession,
    current: CurrentUser,
):
    require_finance_manage(current)
    if payload.expected_version is None:
        raise HTTPException(
            status_code=422,
            detail="expected_version é obrigatório para atualizar um lançamento.",
        )
    entry = FinanceEntryRepository.get_for_organization(
        db, entry_id, current.organization.id, for_update=True
    )
    if entry is None:
        raise not_found("Lançamento")
    try:
        return update_entry(
            db, entry, current.user.id, payload.model_dump(exclude_unset=True)
        )
    except FinanceCategoryUnavailableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except FinanceEntryConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "finance_entry_conflict",
                "message": str(exc),
                "expected_version": exc.expected_version,
                "current": FinanceEntryRead.model_validate(exc.entry).model_dump(
                    mode="json"
                ),
            },
        ) from exc


@router.get("/summary", response_model=FinanceSummaryRead)
def financial_summary(
    db: DatabaseSession,
    current: CurrentUser,
    start_date: date | None = None,
    end_date: date | None = None,
    entry_type: str | None = Query(default=None, pattern="^(income|expense)$"),
    category_id: uuid.UUID | None = None,
):
    require_finance_read(current)
    return FinanceEntryRepository.summary(
        db,
        current.organization.id,
        start_date=start_date,
        end_date=end_date,
        entry_type=entry_type,
        category_id=category_id,
    )
