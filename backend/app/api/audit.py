from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.dependencies import CurrentUser, DatabaseSession, require_audit_read
from app.services.audit import export_events, list_events

router = APIRouter(prefix="/api/audit", tags=["audit"])


def audit_filters(
    module: Literal["Financeiro", "Fiscal", "Pedidos", "Copiloto"] | None = None,
    query: str | None = Query(None, max_length=200),
    actor: str | None = Query(None, max_length=120),
    action: str | None = Query(None, max_length=80),
    entity: str | None = Query(None, max_length=120),
    result: Literal[
        "not_recorded",
        "prepared",
        "executed",
        "cancelled",
        "rejected",
        "denied",
        "rate_limited",
        "error",
    ]
    | None = None,
    origin: Literal["unknown"] | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(422, "A data inicial deve ser anterior ou igual à final.")
    return locals()


Filters = Annotated[dict, Depends(audit_filters)]


@router.get("")
def search(
    db: DatabaseSession,
    current: CurrentUser,
    filters: Filters,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    require_audit_read(current)
    return list_events(db, current.organization.id, filters, page, page_size)


@router.get("/export")
def export(db: DatabaseSession, current: CurrentUser, filters: Filters):
    require_audit_read(current)
    return StreamingResponse(
        export_events(db, current.organization.id, filters),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="auditoria.csv"',
            "Cache-Control": "no-store",
        },
    )
