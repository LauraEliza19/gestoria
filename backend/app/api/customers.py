import uuid

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import CustomerRepository
from app.schemas import (
    CustomerCreate,
    CustomerProfileRead,
    CustomerRead,
    CustomerUpdate,
    PaginatedResponse,
)
from app.services import get_customer_profile

router = APIRouter(prefix="/api/customers", tags=["customers"])


def customer_not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail="Cliente não encontrado.",
    )


def duplicate_customer() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Já existe um cliente com esse telefone nesta empresa.",
    )


def customer_in_use() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Este cliente possui pedidos vinculados e não pode ser excluído.",
    )


@router.get("", response_model=PaginatedResponse[CustomerRead])
def list_customers(
    db: DatabaseSession,
    current: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    active_only: bool | None = None,
    sort: str = Query(default="created_at", pattern="^(created_at|name)$"),
) -> PaginatedResponse[CustomerRead]:
    return CustomerRepository.list_for_organization(
        db,
        current.organization.id,
        page=page,
        page_size=page_size,
        search=search,
        active_only=active_only,
        sort=sort,
    )


@router.post(
    "",
    response_model=CustomerRead,
    status_code=status.HTTP_201_CREATED,
)
def create_customer(
    payload: CustomerCreate,
    db: DatabaseSession,
    current: CurrentUser,
) -> CustomerRead:
    try:
        return CustomerRepository.create(
            db,
            current.organization.id,
            payload.model_dump(),
        )
    except IntegrityError as exc:
        db.rollback()
        raise duplicate_customer() from exc


@router.get(
    "/{customer_id}",
    response_model=CustomerProfileRead,
)
def read_customer_profile(
    customer_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
) -> CustomerProfileRead:
    profile = get_customer_profile(
        db,
        current.organization.id,
        customer_id,
    )

    if profile is None:
        raise customer_not_found()

    return profile


@router.patch(
    "/{customer_id}",
    response_model=CustomerRead,
)
def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    db: DatabaseSession,
    current: CurrentUser,
) -> CustomerRead:
    customer = CustomerRepository.get_for_organization(
        db,
        customer_id,
        current.organization.id,
    )

    if not customer:
        raise customer_not_found()

    try:
        return CustomerRepository.update(
            db,
            customer,
            payload.model_dump(exclude_unset=True),
        )
    except IntegrityError as exc:
        db.rollback()
        raise duplicate_customer() from exc


@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_customer(
    customer_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
) -> Response:
    require_role(current, {"owner", "admin"})

    customer = CustomerRepository.get_for_organization(
        db,
        customer_id,
        current.organization.id,
    )

    if not customer:
        raise customer_not_found()

    try:
        CustomerRepository.delete(db, customer)
    except IntegrityError as exc:
        db.rollback()
        raise customer_in_use() from exc

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )
