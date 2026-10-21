import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies import (
    CurrentUser,
    DatabaseSession,
    require_finance_manage,
    require_finance_read,
)
from app.repositories import FinanceCategoryRepository, FinanceEntryRepository
from app.schemas import (
    FinanceCategoryCreate,
    FinanceCategoryRead,
    FinanceCategoryUpdate,
    FinanceEntryCreate,
    FinanceEntryRead,
    FinanceEntryUpdate,
    FinanceSummaryRead,
)
from app.services import (
    DuplicateFinanceCategoryError,
    FinanceCategoryUnavailableError,
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


@router.post("/categories", response_model=FinanceCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category_route(payload: FinanceCategoryCreate, db: DatabaseSession, current: CurrentUser):
    require_finance_manage(current)
    try:
        return create_category(db, current.organization.id, current.user.id, payload.model_dump())
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
def update_category_route(category_id: uuid.UUID, payload: FinanceCategoryUpdate, db: DatabaseSession, current: CurrentUser):
    require_finance_manage(current)
    category = FinanceCategoryRepository.get_for_organization(db, category_id, current.organization.id)
    if category is None:
        raise not_found("Categoria")
    try:
        return update_category(db, category, current.user.id, payload.model_dump(exclude_unset=True))
    except DuplicateFinanceCategoryError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/entries", response_model=list[FinanceEntryRead])
def list_entries(
    db: DatabaseSession,
    current: CurrentUser,
    start_date: date | None = None,
    end_date: date | None = None,
    entry_type: str | None = Query(default=None, pattern="^(income|expense)$"),
    status_filter: str | None = Query(default=None, alias="status", pattern="^(pending|paid|cancelled)$"),
    category_id: uuid.UUID | None = None,
):
    require_finance_read(current)
    return FinanceEntryRepository.list_for_organization(
        db, current.organization.id, start_date=start_date, end_date=end_date,
        entry_type=entry_type, status=status_filter, category_id=category_id,
    )


@router.post("/entries", response_model=FinanceEntryRead, status_code=status.HTTP_201_CREATED)
def create_entry_route(payload: FinanceEntryCreate, db: DatabaseSession, current: CurrentUser):
    require_finance_manage(current)
    try:
        return create_entry(db, current.organization.id, current.user.id, payload.model_dump())
    except FinanceCategoryUnavailableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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
def update_entry_route(entry_id: uuid.UUID, payload: FinanceEntryUpdate, db: DatabaseSession, current: CurrentUser):
    require_finance_manage(current)
    entry = FinanceEntryRepository.get_for_organization(db, entry_id, current.organization.id, for_update=True)
    if entry is None:
        raise not_found("Lançamento")
    try:
        return update_entry(db, entry, current.user.id, payload.model_dump(exclude_unset=True))
    except FinanceCategoryUnavailableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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
        db, current.organization.id, start_date=start_date, end_date=end_date,
        entry_type=entry_type, category_id=category_id,
    )
