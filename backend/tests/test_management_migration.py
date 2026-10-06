import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_management_migration_upgrade_and_downgrade():
    path = Path("alembic/versions/0010_management_foundation.py")
    spec = importlib.util.spec_from_file_location("management_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    engine = create_engine("sqlite://")

    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(text("CREATE TABLE users (id CHAR(32) PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE organizations (id CHAR(32) PRIMARY KEY)"))

        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()

            inspector = inspect(connection)
            table_names = set(inspector.get_table_names())

            assert {
                "management_cost_centers",
                "management_employees",
                "management_employments",
            } <= table_names

            employee_foreign_keys = {
                tuple(item["constrained_columns"])
                for item in inspector.get_foreign_keys("management_employees")
            }
            assert employee_foreign_keys == {
                ("organization_id",),
                ("user_id",),
            }

            employment_foreign_keys = {
                tuple(item["constrained_columns"])
                for item in inspector.get_foreign_keys("management_employments")
            }
            assert employment_foreign_keys == {
                ("organization_id",),
                ("organization_id", "employee_id"),
                ("organization_id", "cost_center_id"),
            }

            cost_center_unique_constraints = {
                tuple(item["column_names"])
                for item in inspector.get_unique_constraints("management_cost_centers")
            }
            assert {
                ("organization_id", "id"),
                ("organization_id", "code"),
                ("organization_id", "name"),
            } <= cost_center_unique_constraints

            employee_unique_constraints = {
                tuple(item["column_names"])
                for item in inspector.get_unique_constraints("management_employees")
            }
            assert {
                ("organization_id", "id"),
                ("organization_id", "document"),
                ("organization_id", "user_id"),
            } <= employee_unique_constraints

            migration.downgrade()

            assert set(inspect(connection).get_table_names()) == {
                "organizations",
                "users",
            }
