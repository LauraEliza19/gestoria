import uuid

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import ProductRepository
from app.schemas import ProductCreate, ProductRead, ProductUpdate
from app.services import ProductServiceError, create_product, update_product

router = APIRouter(prefix="/api/products", tags=["products"])


def product_not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Produto não encontrado.")


def duplicate_product() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Já existe um produto com esse nome nesta empresa.",
    )


def product_in_use() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Este produto possui itens de pedido vinculados e não pode ser excluído.",
    )


@router.get("", response_model=list[ProductRead])
def list_products(db: DatabaseSession, current: CurrentUser) -> list[ProductRead]:
    return ProductRepository.list_for_organization(db, current.organization.id)


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product_route(
    payload: ProductCreate, db: DatabaseSession, current: CurrentUser
) -> ProductRead:
    try:
        return create_product(
            db,
            current.organization.id,
            payload.model_dump(),
        )
    except IntegrityError:
        db.rollback()
        raise duplicate_product()
    except ProductServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        )


@router.patch("/{product_id}", response_model=ProductRead)
def update_product_route(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: DatabaseSession,
    current: CurrentUser,
) -> ProductRead:
    product = ProductRepository.get_for_organization(
        db, product_id, current.organization.id
    )
    if not product:
        raise product_not_found()

    try:
        return update_product(db, product, payload.model_dump(exclude_unset=True))
    except IntegrityError:
        db.rollback()
        raise duplicate_product()
    except ProductServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        )


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_route(
    product_id: uuid.UUID, db: DatabaseSession, current: CurrentUser
) -> Response:
    require_role(current, {"owner", "admin"})
    product = ProductRepository.get_for_organization(
        db, product_id, current.organization.id
    )
    if not product:
        raise product_not_found()

    try:
        ProductRepository.delete(db, product)
    except IntegrityError:
        db.rollback()
        raise product_in_use()
    return Response(status_code=status.HTTP_204_NO_CONTENT)