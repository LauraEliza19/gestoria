"""Online Alembic tests: isolated schemas on TEST_POSTGRES_URL (never production)."""

import os
import uuid
from contextlib import contextmanager

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError

from alembic import command
from app.config import settings


@contextmanager
def migrated_database(monkeypatch):
    address = os.environ.get("TEST_POSTGRES_URL")
    if not address:
        pytest.skip("TEST_POSTGRES_URL não configurada; migração online não executada")
    admin = create_engine(address)
    schema = "test_fiscal_" + uuid.uuid4().hex
    with admin.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    url = make_url(address).update_query_dict({"options": f"-csearch_path={schema}"})
    engine = create_engine(url)
    monkeypatch.setattr(
        settings, "database_url", url.render_as_string(hide_password=False)
    )
    try:
        command.upgrade(Config("alembic.ini"), "0005_fiscal_documents")
        yield engine
    finally:
        engine.dispose()
        with admin.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


def seed(engine, *, duplicate=False):
    org, doc = uuid.uuid4(), uuid.uuid4()
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO organizations(id,name,slug) VALUES (:id,:name,:slug)"),
            {"id": org, "name": "Histórica", "slug": str(org)},
        )
        stmt = text(
            "INSERT INTO fiscal_documents(id,organization_id,document_type,number,participant_name,issue_date,value,status) VALUES (:id,:org,'saida','100','Cliente histórico','2025-01-01',12.50,'Autorizada')"
        )
        conn.execute(stmt, {"id": doc, "org": org})
        if duplicate:
            conn.execute(stmt, {"id": uuid.uuid4(), "org": org})
    return org, doc


def test_online_upgrade_preserves_historical_document(monkeypatch):
    with migrated_database(monkeypatch) as engine:
        _, doc = seed(engine)
        command.upgrade(Config("alembic.ini"), "head")
        with engine.connect() as conn:
            row = (
                conn.execute(
                    text("SELECT * FROM fiscal_documents WHERE id=:id"), {"id": doc}
                )
                .mappings()
                .one()
            )
            assert (
                row["is_legacy"]
                and row["order_id"] is None
                and row["created_by_id"] is None
            )
            assert row["authorized_at"] is None and str(row["value"]) == "12.50"
            assert row["participant_name"] == "Cliente histórico"
            indexes = {i["name"] for i in inspect(conn).get_indexes("fiscal_documents")}
            assert {
                "uq_fiscal_active_order",
                "ix_fiscal_org_order",
                "ix_fiscal_org_status",
                "ix_fiscal_org_number",
            } <= indexes
        # Old-only data may be rolled back without dropping fiscal history.
        command.downgrade(Config("alembic.ini"), "0005_fiscal_documents")
        command.upgrade(Config("alembic.ini"), "head")


def test_online_preflight_aborts_before_schema_changes(monkeypatch):
    with migrated_database(monkeypatch) as engine:
        seed(engine, duplicate=True)
        with pytest.raises(DBAPIError, match="duplicate outgoing"):
            command.upgrade(Config("alembic.ini"), "head")
        with engine.connect() as conn:
            assert (
                conn.scalar(text("SELECT version_num FROM alembic_version"))
                == "0005_fiscal_documents"
            )
            assert conn.scalar(text("SELECT COUNT(*) FROM fiscal_documents")) == 2
            assert "suppliers" not in inspect(conn).get_table_names()


def test_online_downgrade_protects_new_fiscal_data(monkeypatch):
    with migrated_database(monkeypatch) as engine:
        org, _ = seed(engine)
        command.upgrade(Config("alembic.ini"), "head")
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO suppliers(id,organization_id,name,document,is_active) VALUES (:id,:org,'Fornecedor','12345678000190',true)"
                ),
                {"id": uuid.uuid4(), "org": org},
            )
        with pytest.raises(DBAPIError, match="downgrade blocked"):
            command.downgrade(Config("alembic.ini"), "0005_fiscal_documents")
        with engine.connect() as conn:
            assert conn.scalar(text("SELECT COUNT(*) FROM suppliers")) == 1
            assert (
                conn.scalar(text("SELECT version_num FROM alembic_version"))
                == ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
            )
