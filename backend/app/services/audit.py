"""Read-only projections over existing audit sources; no schema changes."""

import csv
import io
import json
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import JSON, String, case, cast, func, literal, or_, select, union_all

from app.models import FinanceAuditEvent, FiscalEvent, OrderAuditEvent, User
from app.models.copilot import CopilotToolAuditLog


def audit_query(organization_id, filters):
    def project(model, module, entity, entity_id, actor, action, result, data):
        return (
            select(
                model.id.label("id"),
                literal(module).label("module"),
                entity.label("entity"),
                entity_id.label("entity_id"),
                actor.label("actor_id"),
                User.full_name.label("actor_name"),
                User.email.label("actor_email"),
                action.label("action"),
                model.created_at.label("created_at"),
                result.label("result"),
                literal("unknown").label("origin"),
                data.label("data"),
            )
            .outerjoin(User, User.id == actor)
            .where(model.organization_id == organization_id)
        )

    finance = FinanceAuditEvent
    fiscal = FiscalEvent
    orders = OrderAuditEvent
    copilot = CopilotToolAuditLog
    events = union_all(
        project(
            finance,
            "Financeiro",
            case(
                (
                    finance.event_type.like("category_%"),
                    literal("Categoria financeira"),
                ),
                else_=literal("Lançamento financeiro"),
            ),
            finance.entity_id,
            finance.actor_id,
            finance.event_type,
            literal("not_recorded"),
            finance.document,
        ),
        project(
            fiscal,
            "Fiscal",
            literal("Documento fiscal"),
            fiscal.document_id,
            fiscal.actor_id,
            fiscal.action,
            literal("not_recorded"),
            fiscal.detail,
        ),
        project(
            orders,
            "Pedidos",
            literal("Operação de pedido"),
            orders.operation_id,
            orders.actor_id,
            orders.event_type,
            case(
                (
                    orders.event_type.in_(
                        ["prepared", "executed", "cancelled", "rejected"]
                    ),
                    orders.event_type,
                ),
                else_=literal("not_recorded"),
            ),
            orders.document,
        ),
        project(
            copilot,
            "Copiloto",
            literal("Execução de ferramenta"),
            copilot.id,
            copilot.user_id,
            copilot.tool_name,
            copilot.status,
            # Never select/search historical payloads: they may contain secrets.
            literal({"redacted": True}, type_=JSON),
        ),
    ).subquery()
    statement = select(events)
    for name in ("module", "result", "origin"):
        if filters.get(name):
            statement = statement.where(events.c[name] == filters[name])
    for name, columns in {
        "query": ["entity", "entity_id", "action", "data"],
        "actor": ["actor_name", "actor_email", "actor_id"],
        "action": ["action"],
        "entity": ["entity", "entity_id"],
    }.items():
        if filters.get(name):
            statement = statement.where(
                or_(
                    *[
                        cast(events.c[column], String).icontains(
                            filters[name], autoescape=True
                        )
                        for column in columns
                    ]
                )
            )
    if filters.get("start_date"):
        statement = statement.where(
            events.c.created_at
            >= datetime.combine(filters["start_date"], time.min, timezone.utc)
        )
    if filters.get("end_date") and filters["end_date"] < date.max:
        statement = statement.where(
            events.c.created_at
            < datetime.combine(
                filters["end_date"] + timedelta(days=1), time.min, timezone.utc
            )
        )
    return statement, events


def serialize_event(row):
    item = dict(row)
    if item["created_at"].tzinfo is None:
        item["created_at"] = item["created_at"].replace(tzinfo=timezone.utc)
    return item


def list_events(db, organization_id, filters, page, page_size):
    statement, events = audit_query(organization_id, filters)
    total = db.scalar(select(func.count()).select_from(statement.subquery()))
    rows = db.execute(
        statement.order_by(
            events.c.created_at.desc(), events.c.module, events.c.id.desc()
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).mappings()
    return {
        "items": [serialize_event(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": page * page_size < total,
    }


def csv_cell(value):
    text = "" if value is None else str(value)
    # Prevent spreadsheet formulas, including leading whitespace/control characters.
    return (
        "'" + text
        if text.lstrip().startswith(("=", "+", "-", "@"))
        or text.startswith(("\t", "\r", "\n"))
        else text
    )


def export_events(db, organization_id, filters):
    statement, events = audit_query(organization_id, filters)
    output = io.StringIO(newline="")
    writer = csv.writer(output, delimiter=";")
    writer.writerow(
        [
            "Evento",
            "Módulo",
            "Entidade",
            "Registro",
            "Usuário ID",
            "Usuário",
            "E-mail",
            "Ação",
            "Data UTC",
            "Resultado",
            "Origem",
            "Dados",
        ]
    )
    yield "\ufeff" + output.getvalue()
    rows = db.execute(
        statement.order_by(
            events.c.created_at.desc(), events.c.module, events.c.id.desc()
        ).execution_options(yield_per=500)
    ).mappings()
    try:
        for row in rows:
            item = serialize_event(row)
            output.seek(0)
            output.truncate(0)
            writer.writerow(
                [
                    csv_cell(item[key])
                    for key in (
                        "id",
                        "module",
                        "entity",
                        "entity_id",
                        "actor_id",
                        "actor_name",
                        "actor_email",
                        "action",
                        "created_at",
                        "result",
                        "origin",
                    )
                ]
                + [csv_cell(json.dumps(item["data"], ensure_ascii=False))]
            )
            yield output.getvalue()
    finally:
        rows.close()
