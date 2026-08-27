import uuid

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import CustomerRepository
from app.schemas import CustomerCreate, CustomerRead, CustomerUpdate

router = APIRouter(prefix="/api/customers", tags=["customers"])


def customer_not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Cliente não encontrado.")


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


@router.get("", response_model=list[CustomerRead])
def list_customers(db: DatabaseSession, current: CurrentUser) -> list[CustomerRead]:
    return CustomerRepository.list_for_organization(db, current.organization.id)


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate, db: DatabaseSession, current: CurrentUser
) -> CustomerRead:
    try:
        return CustomerRepository.create(
            db,
            current.organization.id,
            payload.model_dump(),
        )
    except IntegrityError:
        db.rollback()
        raise duplicate_customer()


@router.patch("/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    db: DatabaseSession,
    current: CurrentUser,
) -> CustomerRead:
    customer = CustomerRepository.get_for_organization(
        db, customer_id, current.organization.id
    )
    if not customer:
        raise customer_not_found()

    try:
        return CustomerRepository.update(
            db, customer, payload.model_dump(exclude_unset=True)
        )
    except IntegrityError:
        db.rollback()
        raise duplicate_customer()


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: uuid.UUID, db: DatabaseSession, current: CurrentUser
) -> Response:
    require_role(current, {"owner", "admin"})
    customer = CustomerRepository.get_for_organization(
        db, customer_id, current.organization.id
    )
    if not customer:
        raise customer_not_found()

    try:
        CustomerRepository.delete(db, customer)
    except IntegrityError:
        db.rollback()
        raise customer_in_use()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
