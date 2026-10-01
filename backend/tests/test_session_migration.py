import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_cookie_migration_upgrade_and_downgrade():
    path = Path("alembic/versions/0009_cookie_sessions.py")
    spec = importlib.util.spec_from_file_location("cookie_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id CHAR(32) PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE organizations (id CHAR(32) PRIMARY KEY)"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            inspector = inspect(connection)
            assert "auth_sessions" in inspector.get_table_names()
            assert "login_rate_limits" in inspector.get_table_names()
            assert len(inspector.get_foreign_keys("auth_sessions")) == 2
            assert any(
                c["column_names"] == ["token_hash"]
                for c in inspector.get_unique_constraints("auth_sessions")
            )
            migration.downgrade()
            assert inspect(connection).get_table_names() == ["organizations", "users"]
