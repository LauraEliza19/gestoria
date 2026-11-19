"""Migração 0020: sob encomenda, número do pedido, contas a receber e categorias."""

import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.models import FinanceEntry, Order, OrderItem, Organization, Product
from app.services.finance_defaults import DEFAULT_FINANCE_CATEGORIES

REVISION = "0020_made_to_order_receivables"
PREVIOUS = "0019_supplier_contact_fields"


def migration():
    path = Path("alembic/versions/0020_made_to_order_receivables.py")
    spec = importlib.util.spec_from_file_location("made_to_order_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_revision_follows_supplier_contacts_and_fits_alembic():
    scripts = ScriptDirectory.from_config(Config("alembic.ini"))

    assert scripts.get_revision(REVISION).down_revision == PREVIOUS
    assert migration().revision == REVISION
    assert migration().down_revision == PREVIOUS
    assert len(REVISION) <= 32


def test_frozen_default_categories_match_the_application_list():
    # A migração não importa o app; a cópia precisa continuar igual.
    assert migration().DEFAULT_FINANCE_CATEGORIES == DEFAULT_FINANCE_CATEGORIES


def legacy_tables(connection):
    statements = (
        "CREATE TABLE organizations (id INTEGER PRIMARY KEY, "
        "next_order_code INTEGER NOT NULL DEFAULT 1)",
        "CREATE TABLE orders (id INTEGER PRIMARY KEY, organization_id INTEGER, "
        "created_at TEXT, code VARCHAR(20))",
        "CREATE TABLE finance_categories (id INTEGER PRIMARY KEY, "
        "organization_id INTEGER, name TEXT, description TEXT, is_active BOOLEAN)",
        "CREATE TABLE finance_entries (id INTEGER PRIMARY KEY, "
        "organization_id INTEGER, category_id INTEGER)",
        "INSERT INTO organizations (id) VALUES (1), (2), (3)",
        "INSERT INTO orders VALUES (10, 1, '2026-01-02', NULL), "
        "(11, 1, '2026-01-01', NULL), (12, 2, '2026-03-01', NULL)",
        "INSERT INTO finance_categories VALUES (50, 3, 'Minha', NULL, 1)",
    )
    for statement in statements:
        connection.execute(sa.text(statement))


def test_existing_orders_are_numbered_by_creation_date_per_company():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        legacy_tables(connection)

        migration().number_existing_orders(connection)

        codes = dict(connection.execute(sa.text("SELECT id, code FROM orders")).all())
        assert codes == {11: "PED-000001", 10: "PED-000002", 12: "PED-000001"}
        next_codes = dict(
            connection.execute(
                sa.text("SELECT id, next_order_code FROM organizations")
            ).all()
        )
        assert next_codes == {1: 3, 2: 2, 3: 1}
    engine.dispose()


def test_default_categories_only_for_companies_without_any_and_safe_removal():
    module = migration()
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        legacy_tables(connection)

        missing = module.organizations_without_categories(connection)
        assert sorted(missing) == [1, 2]
        rows = module.default_category_rows(missing)
        assert len(rows) == 2 * len(DEFAULT_FINANCE_CATEGORIES)
        for row in rows:
            connection.execute(
                sa.text(
                    "INSERT INTO finance_categories "
                    "(organization_id, name, description, is_active) "
                    "VALUES (:organization_id, :name, :description, :is_active)"
                ),
                row,
            )

        used_id = connection.scalar(
            sa.text(
                "SELECT id FROM finance_categories "
                "WHERE organization_id = 1 AND name = 'Vendas'"
            )
        )
        connection.execute(
            sa.text(
                "INSERT INTO finance_entries (organization_id, category_id) "
                "VALUES (1, :category_id)"
            ),
            {"category_id": used_id},
        )

        module.remove_unused_default_categories(connection)

        remaining = connection.execute(
            sa.text("SELECT organization_id, name FROM finance_categories")
        ).all()
        # A categoria criada pelo usuário e a padrão já usada continuam.
        assert sorted(remaining) == [(1, "Vendas"), (3, "Minha")]
    engine.dispose()


def test_models_match_the_migrated_columns():
    assert not Product.__table__.c.made_to_order.nullable
    assert not OrderItem.__table__.c.stock_deducted.nullable
    assert Order.__table__.c.code.nullable
    assert Order.__table__.c.code.type.length == 20
    assert not Organization.__table__.c.next_order_code.nullable
    assert FinanceEntry.__table__.c.order_id.nullable
    foreign_key = next(iter(FinanceEntry.__table__.c.order_id.foreign_keys))
    assert foreign_key.ondelete == "SET NULL"
    constraints = {
        constraint.name: str(constraint.sqltext)
        for constraint in Product.__table__.constraints
        if isinstance(constraint, sa.CheckConstraint)
    }
    assert constraints["ck_product_category"] == migration().NEW_CATEGORIES
    assert constraints["ck_product_unit_of_measure"] == migration().NEW_UNITS
