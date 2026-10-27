import importlib.util
import uuid
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from conftest import seed_test_data
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from test_fiscal_migration import migrated_database

from alembic import command
from app.models import CopilotToolAuditLog, Organization, User
from app.repositories.copilot import CopilotRepository
from app.schemas.copilot import (
    CopilotAuditListArguments,
    CopilotAuditWrite,
    CopilotNoArguments,
)

REVISION = "0014_copilot_security_gateway"
CUSTOMER_CODES_REVISION = "0014_customer_codes"
MERGE_REVISION = "b48621729e7d"
PREVIOUS = "0013_finance_entry_versions"


def migration():
    path = Path("alembic/versions/0014_copilot_security_gateway.py")
    spec = importlib.util.spec_from_file_location("copilot_gateway_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_gateway_and_customer_codes_are_joined_in_a_single_head():
    scripts = ScriptDirectory.from_config(Config("alembic.ini"))

    assert scripts.get_heads() == [MERGE_REVISION]
    assert set(scripts.get_revision(MERGE_REVISION).down_revision) == {
        REVISION,
        CUSTOMER_CODES_REVISION,
    }
    assert scripts.get_revision(REVISION).down_revision == PREVIOUS
    assert scripts.get_revision(CUSTOMER_CODES_REVISION).down_revision == PREVIOUS
    assert scripts.get_revision(PREVIOUS).down_revision == "2bde4cefcdec"
    assert set(scripts.get_revision("2bde4cefcdec").down_revision) == {
        "0012_finance_module",
        "0012_product_recipe_link",
    }


@pytest.fixture
def sqlite_gateway():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(sa.text("PRAGMA foreign_keys=ON"))
        connection.execute(
            sa.text("CREATE TABLE organizations (id CHAR(32) PRIMARY KEY)")
        )
        connection.execute(sa.text("CREATE TABLE users (id CHAR(32) PRIMARY KEY)"))
        connection.execute(
            sa.text(
                "CREATE TABLE organization_members (organization_id CHAR(32), user_id CHAR(32), PRIMARY KEY (organization_id, user_id))"
            )
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration().upgrade()
            yield connection
    engine.dispose()


def test_gateway_migration_creates_schema_indexes_and_reversible_empty_tables(
    sqlite_gateway,
):
    connection = sqlite_gateway
    inspector = sa.inspect(connection)
    assert {"copilot_tool_audit_logs", "copilot_rate_limits"} <= set(
        inspector.get_table_names()
    )
    expected = CopilotToolAuditLog.__table__
    columns = {
        column["name"]: column for column in inspector.get_columns(expected.name)
    }
    assert set(columns) == set(expected.columns.keys())
    assert all(
        not column["nullable"]
        for name, column in columns.items()
        if name != "question_id"
    )
    assert {index["name"] for index in inspector.get_indexes(expected.name)} == {
        index.name for index in expected.indexes
    }
    assert {
        tuple(foreign["constrained_columns"])
        for foreign in inspector.get_foreign_keys(expected.name)
    } == {
        ("organization_id",),
        ("user_id",),
        ("organization_id", "user_id"),
    }
    assert {
        check["name"] for check in inspector.get_check_constraints(expected.name)
    } == {
        "ck_copilot_audit_status",
        "ck_copilot_audit_duration",
    }
    migration().downgrade()
    assert set(sa.inspect(connection).get_table_names()) == {
        "organizations",
        "users",
        "organization_members",
    }


@pytest.mark.parametrize("invalid", ["status", "duration", "membership"])
def test_migration_database_constraints_cannot_be_bypassed(sqlite_gateway, invalid):
    connection = sqlite_gateway
    org, user = uuid.uuid4(), uuid.uuid4()
    connection.execute(
        sa.text("INSERT INTO organizations VALUES (:id)"), {"id": org.hex}
    )
    connection.execute(sa.text("INSERT INTO users VALUES (:id)"), {"id": user.hex})
    if invalid != "membership":
        connection.execute(
            sa.text("INSERT INTO organization_members VALUES (:org, :user)"),
            {"org": org.hex, "user": user.hex},
        )
    values = {
        "id": uuid.uuid4(),
        "organization_id": org,
        "user_id": user,
        "question_id": "unknown",
        "tool_name": "unknown",
        "input_payload": {},
        "status": "invalid" if invalid == "status" else "executed",
        "execution_time_ms": -1 if invalid == "duration" else 0,
    }
    with connection.begin_nested(), pytest.raises(IntegrityError):
        connection.execute(sa.insert(CopilotToolAuditLog), values)


def test_downgrade_refuses_to_delete_audit_history(sqlite_gateway):
    connection = sqlite_gateway
    org, user = uuid.uuid4(), uuid.uuid4()
    connection.execute(
        sa.text("INSERT INTO organizations VALUES (:id)"), {"id": org.hex}
    )
    connection.execute(sa.text("INSERT INTO users VALUES (:id)"), {"id": user.hex})
    connection.execute(
        sa.text("INSERT INTO organization_members VALUES (:org, :user)"),
        {"org": org.hex, "user": user.hex},
    )
    connection.execute(
        sa.insert(CopilotToolAuditLog),
        {
            "id": uuid.uuid4(),
            "organization_id": org,
            "user_id": user,
            "question_id": "unknown",
            "tool_name": "unknown",
            "input_payload": {},
            "status": "executed",
            "execution_time_ms": 0,
        },
    )
    with pytest.raises(RuntimeError, match="Downgrade bloqueado"):
        migration().downgrade()
    assert (
        connection.scalar(sa.select(sa.func.count()).select_from(CopilotToolAuditLog))
        == 1
    )
    assert "copilot_rate_limits" in sa.inspect(connection).get_table_names()


def test_online_gateway_upgrade_from_previous_head_and_persistence(monkeypatch):
    with migrated_database(monkeypatch) as engine:
        command.upgrade(Config("alembic.ini"), PREVIOUS)
        with Session(engine) as db:
            seed_test_data(db)
        command.upgrade(Config("alembic.ini"), "head")
        with Session(engine) as db:
            org = db.scalar(
                sa.select(Organization).where(Organization.slug == "empresa-a")
            )
            other = db.scalar(
                sa.select(Organization).where(Organization.slug == "empresa-b")
            )
            user = db.scalar(sa.select(User).where(User.email == "lucas@gestoria.dev"))
            entry = CopilotAuditWrite(
                question_id="unknown",
                tool_name="unknown",
                input_payload=CopilotNoArguments(),
                status="denied",
                execution_time_ms=0,
            )
            CopilotRepository.write_tool_audit(
                db, organization_id=org.id, user_id=user.id, entry=entry
            )
            result = CopilotRepository.list_tool_audit_logs(
                db, organization_id=org.id, arguments=CopilotAuditListArguments()
            )
            assert len(result) == 1 and result[0].status == "denied"
            assert result[0].created_at.utcoffset().total_seconds() == 0
            assert not CopilotRepository.list_tool_audit_logs(
                db, organization_id=other.id, arguments=CopilotAuditListArguments()
            )
        with pytest.raises(RuntimeError, match="Downgrade bloqueado"):
            command.downgrade(Config("alembic.ini"), PREVIOUS)
        with engine.connect() as connection:
            assert (
                connection.scalar(sa.text("SELECT version_num FROM alembic_version"))
                == MERGE_REVISION
            )
            assert (
                connection.scalar(
                    sa.select(sa.func.count()).select_from(CopilotToolAuditLog)
                )
                == 1
            )
