import uuid

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import production as repository
from app.schemas.production import (
    ProductionRead,
    RecipeInput,
    StockItemInput,
    StockItemRead,
)
from app.services import production as service

router = APIRouter(prefix="/api/production", tags=["production"])


def found(value):
    if value is None:
        raise HTTPException(status_code=404, detail="Cadastro não encontrado.")
    return value


def conflict(db, message):
    db.rollback()
    raise HTTPException(status_code=409, detail=message)


@router.get("", response_model=ProductionRead)
def overview(db: DatabaseSession, current: CurrentUser):
    return service.overview(db, current.organization.id)


@router.post("/stock-items", response_model=StockItemRead, status_code=201)
def create_stock_item(
    payload: StockItemInput, db: DatabaseSession, current: CurrentUser
):
    return write_stock(db, current.organization.id, payload)


@router.put("/stock-items/{stock_id}", response_model=StockItemRead)
def update_stock_item(
    stock_id: uuid.UUID,
    payload: StockItemInput,
    db: DatabaseSession,
    current: CurrentUser,
):
    stock = found(repository.get_stock_item(db, current.organization.id, stock_id))
    return write_stock(db, current.organization.id, payload, stock)


def write_stock(db, organization_id, payload, stock=None):
    try:
        return service.save_stock_item(db, organization_id, payload, stock)
    except service.ProductionError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))
    except IntegrityError:
        conflict(
            db,
            "Já existe um item com esse nome ou o ingrediente foi cadastrado em outra operação. Atualize e tente novamente.",
        )


@router.delete("/stock-items/{stock_id}", status_code=204)
def delete_stock_item(stock_id: uuid.UUID, db: DatabaseSession, current: CurrentUser):
    require_role(current, {"owner", "admin"})
    stock = found(repository.get_stock_item(db, current.organization.id, stock_id))
    db.delete(stock)
    db.commit()
    return Response(status_code=204)


@router.post("/recipes", status_code=201)
def create_recipe(payload: RecipeInput, db: DatabaseSession, current: CurrentUser):
    return write_recipe(db, current.organization.id, payload)


@router.put("/recipes/{recipe_id}")
def update_recipe(
    recipe_id: uuid.UUID,
    payload: RecipeInput,
    db: DatabaseSession,
    current: CurrentUser,
):
    recipe = found(repository.get_recipe(db, current.organization.id, recipe_id))
    return write_recipe(db, current.organization.id, payload, recipe)


def write_recipe(db, organization_id, payload, recipe=None):
    try:
        saved = service.save_recipe(db, organization_id, payload, recipe)
        return {"id": saved.id}
    except service.ProductionError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))
    except IntegrityError:
        conflict(
            db,
            "Receita ou ingrediente já cadastrado. Atualize os cadastros e tente novamente.",
        )


@router.delete("/recipes/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: uuid.UUID, db: DatabaseSession, current: CurrentUser):
    require_role(current, {"owner", "admin"})
    recipe = found(repository.get_recipe(db, current.organization.id, recipe_id))
    db.delete(recipe)
    db.commit()
    return Response(status_code=204)
