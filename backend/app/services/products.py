import uuid

from sqlalchemy.orm import Session

from app.models import Product
from app.repositories import ProductRepository
from app.repositories import production as production_repository


class ProductServiceError(Exception):
    """Erro de regra de negócio ao criar/atualizar um produto."""


class InvalidPerishabilityDataError(ProductServiceError):
    def __init__(self):
        super().__init__(
            "Produtos perecíveis precisam informar a validade em dias "
            "(shelf_life_days)."
        )


class RecipeNotFoundError(ProductServiceError):
    def __init__(self):
        super().__init__("Receita não encontrada nesta empresa.")


def _validate_recipe(db: Session, organization_id: uuid.UUID, values: dict) -> None:
    recipe_id = values.get("recipe_id")
    if recipe_id is not None and (
        production_repository.get_recipe(db, organization_id, recipe_id) is None
    ):
        raise RecipeNotFoundError()


def _validate_perishability(values: dict, existing: Product | None) -> None:
    """
    Garante que todo produto perecível tenha uma validade definida. Como o
    PATCH é parcial (payload pode não tocar em 'perishable' nem em
    'shelf_life_days'), essa checagem precisa olhar o estado atual do
    produto no banco — por isso vive no service, e não no schema.
    """
    perishable = values.get("perishable", existing.perishable if existing else False)
    shelf_life_days = values.get(
        "shelf_life_days", existing.shelf_life_days if existing else None
    )
    if perishable and shelf_life_days is None:
        raise InvalidPerishabilityDataError()


def create_product(db: Session, organization_id: uuid.UUID, values: dict) -> Product:
    _validate_perishability(values, existing=None)
    _validate_recipe(db, organization_id, values)
    return ProductRepository.create(db, organization_id, values)


def update_product(db: Session, product: Product, values: dict) -> Product:
    _validate_perishability(values, existing=product)
    _validate_recipe(db, product.organization_id, values)
    return ProductRepository.update(db, product, values)
