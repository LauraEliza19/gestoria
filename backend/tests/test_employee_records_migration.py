import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def load_migration(path: str, module_name: str):
    spec = importlib.util.spec_from_file_location(
        module_name,
        Path(path),
    )
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


def test_employee_records_migration_upgrade_and_downgrade():
    management_migration = load_migration(
        "alembic/versions/0010_management_foundation.py",
        "management_foundation_migration",
    )
    records_migration = load_migration(
        "alembic/versions/0011_employee_records.py",
        "employee_records_migration",
    )

    engine = create_engine("sqlite://")

    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(text("CREATE TABLE users (id CHAR(32) PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE organizations (id CHAR(32) PRIMARY KEY)"))
        connection.execute(
            text(
                "CREATE TABLE organization_members ("
                "organization_id CHAR(32) NOT NULL, "
                "user_id CHAR(32) NOT NULL, "
                "PRIMARY KEY (organization_id, user_id)"
                ")"
            )
        )

        with Operations.context(MigrationContext.configure(connection)):
            management_migration.upgrade()
            records_migration.upgrade()

            inspector = inspect(connection)

            assert "management_employee_records" in set(inspector.get_table_names())

            columns = {
                item["name"]: item
                for item in inspector.get_columns("management_employee_records")
            }

            assert {
                "id",
                "organization_id",
                "employee_id",
                "recorded_by_id",
                "updated_by_id",
                "resolved_by_id",
                "cancelled_by_id",
                "record_type",
                "severity",
                "status",
                "title",
                "description",
                "occurred_at",
                "resolution_notes",
                "cancellation_reason",
                "resolved_at",
                "cancelled_at",
                "created_at",
                "updated_at",
            } <= set(columns)

            assert columns["organization_id"]["nullable"] is False
            assert columns["employee_id"]["nullable"] is False
            assert columns["recorded_by_id"]["nullable"] is False
            assert columns["updated_by_id"]["nullable"] is False
            assert columns["title"]["nullable"] is False
            assert columns["description"]["nullable"] is False
            assert columns["occurred_at"]["nullable"] is False

            foreign_keys = {
                tuple(item["constrained_columns"])
                for item in inspector.get_foreign_keys("management_employee_records")
            }

            assert {
                ("organization_id",),
                ("organization_id", "employee_id"),
                ("organization_id", "recorded_by_id"),
                ("organization_id", "updated_by_id"),
                ("organization_id", "resolved_by_id"),
                ("organization_id", "cancelled_by_id"),
            } <= foreign_keys

            unique_constraints = {
                tuple(item["column_names"])
                for item in inspector.get_unique_constraints(
                    "management_employee_records"
                )
            }

            assert (
                "organization_id",
                "id",
            ) in unique_constraints

            indexes = {
                tuple(item["column_names"])
                for item in inspector.get_indexes("management_employee_records")
            }

            assert {
                (
                    "organization_id",
                    "employee_id",
                    "occurred_at",
                ),
                (
                    "organization_id",
                    "status",
                    "occurred_at",
                ),
            } <= indexes

            check_constraints = {
                item["name"]
                for item in inspector.get_check_constraints(
                    "management_employee_records"
                )
            }

            assert {
                "ck_management_employee_record_type",
                "ck_management_employee_record_severity",
                "ck_management_employee_record_status",
                "ck_management_employee_record_resolution",
                "ck_management_employee_record_cancellation",
            } <= check_constraints

            records_migration.downgrade()

            assert "management_employee_records" not in set(
                inspect(connection).get_table_names()
            )

            assert {
                "management_cost_centers",
                "management_employees",
                "management_employments",
            } <= set(inspect(connection).get_table_names())

            management_migration.downgrade()

            assert set(inspect(connection).get_table_names()) == {
                "organization_members",
                "organizations",
                "users",
            }
