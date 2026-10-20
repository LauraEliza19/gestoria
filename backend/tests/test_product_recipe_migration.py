import pytest
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from test_fiscal_migration import migrated_database, seed

from alembic import command
from app.models import Product
from app.models.production import Recipe


def test_link_migration_only_downgrades_without_links(monkeypatch):
    with migrated_database(monkeypatch) as engine:
        org, _ = seed(engine)
        command.upgrade(Config("alembic.ini"), "0012_product_recipe_link")
        with Session(engine) as db:
            recipe = Recipe(
                organization_id=org,
                name="Pão",
                name_key="pao",
                yield_quantity=30,
                yield_unit="unidades",
            )
            db.add(recipe)
            db.flush()
            db.add(
                Product(
                    organization_id=org,
                    name="Pão francês",
                    price=1,
                    recipe_id=recipe.id,
                )
            )
            db.commit()
        with pytest.raises(RuntimeError, match="Product recipe downgrade blocked"):
            command.downgrade(Config("alembic.ini"), "0011_employee_records")
        with engine.begin() as conn:
            assert (
                conn.scalar(
                    text("SELECT COUNT(*) FROM products WHERE recipe_id IS NOT NULL")
                )
                == 1
            )
            conn.execute(text("UPDATE products SET recipe_id = NULL"))
        command.downgrade(Config("alembic.ini"), "0011_employee_records")
        assert "recipe_id" not in {
            column["name"] for column in inspect(engine).get_columns("products")
        }
        command.upgrade(Config("alembic.ini"), "0012_product_recipe_link")
