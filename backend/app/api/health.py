import logging
from functools import lru_cache
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import DatabaseSession

router = APIRouter(prefix="/api/health", tags=["health"])
logger = logging.getLogger(__name__)
backend_dir = Path(__file__).resolve().parents[2]


def check_database(db: Session) -> None:
    db.execute(text("SELECT 1"))


def current_migration_revision(db: Session) -> str | None:
    revisions = tuple(
        str(revision)
        for revision in db.execute(
            text("SELECT version_num FROM alembic_version")
        ).scalars()
    )
    return revisions[0] if len(revisions) == 1 else None


@lru_cache(maxsize=1)
def expected_migration_revision() -> str | None:
    config = Config()
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    return ScriptDirectory.from_config(config).get_current_head()


def readiness_report(db: Session) -> tuple[dict[str, object], int]:
    checks: dict[str, object] = {}

    try:
        check_database(db)
        checks["database"] = {"status": "ok"}
    except Exception:
        logger.exception("Readiness falhou ao consultar o banco de dados")
        checks["database"] = {"status": "error"}
        checks["migrations"] = {"status": "skipped"}
        return {"status": "not_ready", "checks": checks}, 503

    try:
        current_revision = current_migration_revision(db)
        expected_revision = expected_migration_revision()
        migration_is_current = (
            current_revision is not None
            and expected_revision is not None
            and current_revision == expected_revision
        )
        checks["migrations"] = {
            "status": "ok" if migration_is_current else "error",
            "current": current_revision,
            "expected": expected_revision,
        }
    except Exception:
        logger.exception("Readiness falhou ao verificar as migrations")
        checks["migrations"] = {"status": "error"}
        return {"status": "not_ready", "checks": checks}, 503

    if not migration_is_current:
        return {"status": "not_ready", "checks": checks}, 503

    return {"status": "ready", "checks": checks}, 200


@router.get("")
def legacy_health() -> dict[str, str]:
    """Compatibilidade com clientes que ainda consultam /api/health."""
    return {"status": "ok"}


@router.get("/live")
def liveness() -> dict[str, str]:
    """Confirma somente que o processo HTTP está vivo."""
    return {"status": "ok"}


@router.get("/ready")
def readiness(db: DatabaseSession) -> JSONResponse:
    """Libera tráfego apenas com banco acessível e schema atualizado."""
    report, status_code = readiness_report(db)
    return JSONResponse(content=report, status_code=status_code)
