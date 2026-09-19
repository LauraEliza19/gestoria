from sqlalchemy import delete, select

from app.models.production import Ingredient, Recipe, RecipeIngredient, StockItem


def list_ingredients(db, organization_id):
    return list(
        db.scalars(
            select(Ingredient)
            .where(Ingredient.organization_id == organization_id)
            .order_by(Ingredient.name, Ingredient.id)
        )
    )


def list_stock_items(db, organization_id):
    return list(
        db.scalars(
            select(StockItem)
            .where(StockItem.organization_id == organization_id)
            .order_by(StockItem.name, StockItem.id)
        )
    )


def get_stock_item(db, organization_id, stock_id):
    return db.scalar(
        select(StockItem).where(
            StockItem.organization_id == organization_id, StockItem.id == stock_id
        )
    )


def list_recipes(db, organization_id):
    return list(
        db.scalars(
            select(Recipe)
            .where(Recipe.organization_id == organization_id)
            .order_by(Recipe.name, Recipe.id)
        )
    )


def list_items(db, organization_id):
    return list(
        db.scalars(
            select(RecipeIngredient)
            .where(RecipeIngredient.organization_id == organization_id)
            .order_by(RecipeIngredient.recipe_id, RecipeIngredient.ingredient_id)
        )
    )


def get_recipe(db, organization_id, recipe_id):
    return db.scalar(
        select(Recipe).where(
            Recipe.organization_id == organization_id, Recipe.id == recipe_id
        )
    )


def clear_recipe_items(db, organization_id, recipe_id):
    db.execute(
        delete(RecipeIngredient).where(
            RecipeIngredient.organization_id == organization_id,
            RecipeIngredient.recipe_id == recipe_id,
        )
    )
