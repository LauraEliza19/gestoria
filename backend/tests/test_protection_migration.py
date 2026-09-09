import os
import uuid

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from alembic import command
from app.config import settings


def test_full_migration_on_postgres(monkeypatch):
    address = os.environ.get("TEST_POSTGRES_URL")
    if not address:
        pytest.skip(
            "TEST_POSTGRES_URL não configurada; migrations PostgreSQL não executadas"
        )
    engine = create_engine(address)
    schema = "test_migration_" + uuid.uuid4().hex
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    scoped = make_url(address).update_query_dict({"options": f"-csearch_path={schema}"})
    monkeypatch.setattr(
        settings, "database_url", scoped.render_as_string(hide_password=False)
    )
    try:
        command.upgrade(Config("alembic.ini"), "head")
        with engine.connect() as connection:
            tables = inspect(connection).get_table_names(schema=schema)
            assert {"order_operations", "order_audit_events", "orders"} <= set(tables)
            columns = {
                c["name"]: c
                for c in inspect(connection).get_columns("order_items", schema=schema)
            }
            assert columns["quantity"]["type"].scale == 3
        command.downgrade(Config("alembic.ini"), "e8559033a8ca")
        command.upgrade(Config("alembic.ini"), "head")
    finally:
        with engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        engine.dispose()
