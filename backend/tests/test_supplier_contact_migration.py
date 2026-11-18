"""Migração 0019: telefone e e-mail opcionais em fornecedores."""

import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory

from app.models import Supplier

REVISION = "0019_supplier_contact_fields"
PREVIOUS = "0018_order_delivery_planning"
ORIGINAL_COLUMNS = {"id", "organization_id", "name", "document", "is_active"}


def migration():
    path = Path("alembic/versions/0019_supplier_contact_fields.py")
    spec = importlib.util.spec_from_file_location("supplier_contact_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def columns(connection):
    return {
        column["name"]: column
        for column in sa.inspect(connection).get_columns("suppliers")
    }


def test_supplier_contact_revision_follows_order_delivery_planning():
    scripts = ScriptDirectory.from_config(Config("alembic.ini"))

    assert scripts.get_revision(REVISION).down_revision == PREVIOUS
    assert migration().revision == REVISION
    assert migration().down_revision == PREVIOUS
    # A coluna version_num do Alembic aceita no máximo 32 caracteres.
    assert len(REVISION) <= 32


def test_supplier_contact_columns_are_optional_and_reversible():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "CREATE TABLE suppliers (id CHAR(32) PRIMARY KEY, "
                "organization_id CHAR(32) NOT NULL, name VARCHAR(160) NOT NULL, "
                "document VARCHAR(18) NOT NULL, is_active BOOLEAN NOT NULL)"
            )
        )
        connection.execute(
            sa.text(
                "INSERT INTO suppliers VALUES "
                "('s1', 'o1', 'Fornecedor antigo', '12345678000190', 1)"
            )
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration().upgrade()

            upgraded = columns(connection)
            assert set(upgraded) == ORIGINAL_COLUMNS | {"phone", "email"}
            assert upgraded["phone"]["nullable"] and upgraded["email"]["nullable"]
            assert upgraded["phone"]["type"].length == 30
            assert upgraded["email"]["type"].length == 255

            # Fornecedores existentes permanecem intactos, sem contato.
            row = connection.execute(
                sa.text("SELECT name, document, is_active, phone, email FROM suppliers")
            ).one()
            assert tuple(row) == ("Fornecedor antigo", "12345678000190", 1, None, None)

            connection.execute(
                sa.text(
                    "UPDATE suppliers SET phone = '35999998888', "
                    "email = 'compras@fornecedor.com.br'"
                )
            )

            migration().downgrade()

            assert set(columns(connection)) == ORIGINAL_COLUMNS
            assert connection.execute(
                sa.text("SELECT name, document FROM suppliers")
            ).one() == ("Fornecedor antigo", "12345678000190")
    engine.dispose()


def test_supplier_model_matches_the_migrated_columns():
    table = Supplier.__table__

    assert table.c.phone.nullable and table.c.email.nullable
    assert table.c.phone.type.length == 30
    assert table.c.email.type.length == 255
    assert ORIGINAL_COLUMNS | {"phone", "email"} <= set(table.c.keys())
