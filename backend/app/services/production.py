import unicodedata
from collections import defaultdict
from decimal import Decimal

from app.models.production import Ingredient, Recipe, RecipeIngredient, StockItem
from app.repositories import production as repository
from app.schemas.production import (
    IngredientRead,
    ProductionRead,
    RecipeItemRead,
    RecipeRead,
    StockItemRead,
)

UNITS = {
    "g": ("mass", Decimal(1)),
    "kg": ("mass", Decimal(1000)),
    "ml": ("volume", Decimal(1)),
    "L": ("volume", Decimal(1000)),
    "un": ("count", Decimal(1)),
}


class ProductionError(ValueError):
    pass


def normalize_name(name: str) -> str:
    decomposed = unicodedata.normalize("NFD", name.lower())
    return " ".join(
        "".join(char for char in decomposed if not unicodedata.combining(char)).split()
    )


def convert(quantity: Decimal, source: str, target: str) -> Decimal:
    source_dimension, source_factor = UNITS[source]
    target_dimension, target_factor = UNITS[target]
    if source_dimension != target_dimension:
        raise ProductionError("Use unidades compatíveis: g/kg, ml/L ou unidades.")
    return quantity * source_factor / target_factor


def resolve_ingredient(db, organization_id, selection, catalog):
    if selection.ingredient_id is not None:
        ingredient = next(
            (item for item in catalog if item.id == selection.ingredient_id), None
        )
        if ingredient is None:
            raise ProductionError("Ingrediente não encontrado nesta empresa.")
    else:
        key = normalize_name(selection.ingredient_name)
        matches = [item for item in catalog if normalize_name(item.name) == key]
        if len(matches) > 1:
            raise ProductionError(
                "Há mais de um ingrediente com esse nome. Selecione o cadastro desejado."
            )
        if matches:
            ingredient = matches[0]
        else:
            # Only exact normalized names are reused. Typos and brands require
            # an explicit selection from the user, never fuzzy auto-linking.
            ingredient = Ingredient(
                organization_id=organization_id,
                name=" ".join(selection.ingredient_name.split()),
                name_key=key,
                unit=selection.unit,
            )
            db.add(ingredient)
            db.flush()
            catalog.append(ingredient)
    convert(selection.quantity, selection.unit, ingredient.unit)
    return ingredient


def overview(db, organization_id) -> ProductionRead:
    ingredients = repository.list_ingredients(db, organization_id)
    by_id = {ingredient.id: ingredient for ingredient in ingredients}
    stock_items = repository.list_stock_items(db, organization_id)
    available_by_id = defaultdict(Decimal)
    for stock in stock_items:
        ingredient = by_id[stock.ingredient_id]
        available_by_id[ingredient.id] += convert(
            stock.quantity, stock.unit, ingredient.unit
        )
    grouped = defaultdict(list)
    for item in repository.list_items(db, organization_id):
        grouped[item.recipe_id].append(item)
    recipes = []
    for recipe in repository.list_recipes(db, organization_id):
        items = []
        limits = []
        for item in grouped[recipe.id]:
            ingredient = by_id[item.ingredient_id]
            available = convert(
                available_by_id[ingredient.id], ingredient.unit, item.unit
            )
            limits.append(int(available // item.quantity))
            items.append(
                RecipeItemRead(
                    ingredient_id=ingredient.id,
                    ingredient_name=ingredient.name,
                    quantity=item.quantity,
                    unit=item.unit,
                    available_quantity=available,
                    missing_quantity=max(Decimal(0), item.quantity - available),
                )
            )
        max_batches = min(limits) if limits else 0
        recipes.append(
            RecipeRead(
                id=recipe.id,
                name=recipe.name,
                yield_quantity=recipe.yield_quantity,
                yield_unit=recipe.yield_unit,
                items=items,
                max_batches=max_batches,
                possible_yield=recipe.yield_quantity * max_batches,
            )
        )
    return ProductionRead(
        ingredients=[IngredientRead.model_validate(item) for item in ingredients],
        stock_items=[
            stock_read(item, by_id[item.ingredient_id]) for item in stock_items
        ],
        recipes=recipes,
    )


def stock_read(stock, ingredient):
    return StockItemRead(
        id=stock.id,
        name=stock.name,
        quantity=stock.quantity,
        unit=stock.unit,
        ingredient_id=ingredient.id,
        ingredient_name=ingredient.name,
    )


def save_stock_item(db, organization_id, payload, stock=None):
    catalog = repository.list_ingredients(db, organization_id)
    ingredient = resolve_ingredient(db, organization_id, payload, catalog)
    if stock is None:
        stock = StockItem(organization_id=organization_id)
        db.add(stock)
    stock.ingredient_id = ingredient.id
    stock.name = payload.name
    stock.name_key = normalize_name(payload.name)
    stock.quantity = payload.quantity
    stock.unit = payload.unit
    db.commit()
    db.refresh(stock)
    return stock_read(stock, ingredient)


def save_recipe(db, organization_id, payload, recipe=None):
    catalog = repository.list_ingredients(db, organization_id)
    resolved = [
        (item, resolve_ingredient(db, organization_id, item, catalog))
        for item in payload.items
    ]
    if len({ingredient.id for _, ingredient in resolved}) != len(resolved):
        raise ProductionError(
            "Cada ingrediente deve aparecer apenas uma vez na receita."
        )
    if recipe is None:
        recipe = Recipe(organization_id=organization_id)
        db.add(recipe)
    recipe.name = payload.name
    recipe.name_key = payload.name.casefold()
    recipe.yield_quantity = payload.yield_quantity
    recipe.yield_unit = payload.yield_unit
    db.flush()
    repository.clear_recipe_items(db, organization_id, recipe.id)
    db.add_all(
        [
            RecipeIngredient(
                organization_id=organization_id,
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                quantity=item.quantity,
                unit=item.unit,
            )
            for item, ingredient in resolved
        ]
    )
    db.commit()
    return recipe
