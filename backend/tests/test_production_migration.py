from alembic.config import Config
from sqlalchemy import inspect
from test_fiscal_migration import migrated_database, seed

from alembic import command


def test_production_upgrade_and_downgrade_preserve_existing_data(monkeypatch):
    with migrated_database(monkeypatch) as engine:
        seed(engine)
        command.upgrade(Config("alembic.ini"), "0006_fiscal_integrity")
        before = set(inspect(engine).get_table_names())
        command.upgrade(Config("alembic.ini"), "0007_kitchen_production")
        added = {
            "production_ingredients",
            "production_recipes",
            "production_recipe_ingredients",
        }
        assert set(inspect(engine).get_table_names()) == before | added
        assert (
            len(inspect(engine).get_foreign_keys("production_recipe_ingredients")) == 2
        )
        command.downgrade(Config("alembic.ini"), "0006_fiscal_integrity")
        assert set(inspect(engine).get_table_names()) == before
        command.upgrade(Config("alembic.ini"), "0007_kitchen_production")
