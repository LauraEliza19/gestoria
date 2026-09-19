import uuid
from decimal import Decimal

import pytest
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from test_fiscal_migration import migrated_database, seed

from alembic import command
from app.services.production import overview


def test_existing_recipes_and_stock_are_preserved(monkeypatch):
    with migrated_database(monkeypatch) as engine:
        org, _ = seed(engine)
        command.upgrade(Config("alembic.ini"), "0007_kitchen_production")
        ingredient_id, recipe_id = uuid.uuid4(), uuid.uuid4()
        with engine.begin() as conn:
            conn.execute(
                text("""
                INSERT INTO production_ingredients (id, organization_id, name, name_key, quantity, unit)
                VALUES (:id, :org, 'Farinha', 'farinha', 1.5, 'kg')
            """),
                {"id": ingredient_id, "org": org},
            )
            conn.execute(
                text("""
                INSERT INTO production_recipes (id, organization_id, name, name_key, yield_quantity, yield_unit)
                VALUES (:id, :org, 'Pao', 'pao', 30, 'unidades')
            """),
                {"id": recipe_id, "org": org},
            )
            conn.execute(
                text("""
                INSERT INTO production_recipe_ingredients (recipe_id, ingredient_id, organization_id, quantity, unit)
                VALUES (:recipe, :ingredient, :org, 500, 'g')
            """),
                {"recipe": recipe_id, "ingredient": ingredient_id, "org": org},
            )
        command.upgrade(Config("alembic.ini"), "0008_recipe_ingredients")
        assert "quantity" not in {
            column["name"]
            for column in inspect(engine).get_columns("production_ingredients")
        }
        with Session(engine) as db:
            data = overview(db, org)
            assert data.stock_items[0].id == ingredient_id
            assert data.stock_items[0].ingredient_id == ingredient_id
            assert data.stock_items[0].quantity == Decimal("1.5")
            assert data.recipes[0].id == recipe_id
            assert data.recipes[0].max_batches == 3
        with pytest.raises(RuntimeError, match="Production downgrade blocked"):
            command.downgrade(Config("alembic.ini"), "0007_kitchen_production")
        with engine.connect() as conn:
            assert conn.scalar(
                text("SELECT quantity FROM production_stock_items")
            ) == Decimal("1.5")
            assert (
                conn.scalar(text("SELECT version_num FROM alembic_version"))
                == "0008_recipe_ingredients"
            )


def test_empty_migration_is_reversible(monkeypatch):
    with migrated_database(monkeypatch) as engine:
        command.upgrade(Config("alembic.ini"), "0008_recipe_ingredients")
        command.downgrade(Config("alembic.ini"), "0007_kitchen_production")
        assert "production_stock_items" not in inspect(engine).get_table_names()
        command.upgrade(Config("alembic.ini"), "0008_recipe_ingredients")
