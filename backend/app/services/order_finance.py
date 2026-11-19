"""Contas a receber geradas pelos pedidos.

Todas as funções gravam na mesma transação do pedido e nunca fazem commit:
se o pedido falhar, nenhuma conta a receber fica para trás.
"""

import uuid
from calendar import monthrange
from datetime import UTC, date
from decimal import ROUND_DOWN, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import FinanceEntry, Order
from app.models.finance import business_today
from app.repositories import FinanceEntryRepository
from app.services.finance import _audit
from app.services.finance_defaults import ensure_sales_category

_CENT = Decimal("0.01")


def order_label(order: Order) -> str:
    return order.code or f"#{str(order.id)[:8].upper()}"


def split_amount(total: Decimal, installments: int) -> list[Decimal]:
    """Divide o total em parcelas; os centavos que sobram vão na primeira."""
    installments = max(1, installments)
    base = (total / installments).quantize(_CENT, rounding=ROUND_DOWN)
    amounts = [base] * installments
    amounts[0] += total - base * installments
    return amounts


def add_months(start: date, months: int) -> date:
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, monthrange(year, month)[1])
    return date(year, month, day)


def first_due_date(order: Order, today: date) -> date:
    """Vence na entrega combinada; sem data de entrega, vence hoje."""
    if order.promised_at is None:
        return today
    promised = order.promised_at
    if promised.tzinfo is None:
        # O sistema grava em UTC; alguns bancos devolvem a data sem o fuso.
        promised = promised.replace(tzinfo=UTC)
    local_date = promised.astimezone(ZoneInfo(settings.business_timezone)).date()
    return max(local_date, today)


def create_order_receivables(
    db: Session,
    order: Order,
    actor_id: uuid.UUID,
    *,
    installment_count: int = 1,
) -> list[FinanceEntry]:
    total = Decimal(order.total_amount)
    if total <= 0:
        return []

    category, created_values = ensure_sales_category(db, order.organization_id)
    if created_values is not None:
        _audit(
            db,
            order.organization_id,
            actor_id,
            "category_created",
            category.id,
            created_values,
        )

    today = business_today()
    first_due = first_due_date(order, today)
    customer_name = order.customer.name if order.customer else "cliente"
    amounts = split_amount(total, installment_count)
    entries = []
    for index, amount in enumerate(amounts):
        description = f"Pedido {order_label(order)} - {customer_name}"
        if len(amounts) > 1:
            description += f" (parcela {index + 1}/{len(amounts)})"
        values = {
            "category_id": category.id,
            "description": description[:200],
            "amount": amount,
            "entry_type": "income",
            "status": "pending",
            "transaction_date": today,
            "due_date": add_months(first_due, index),
            "paid_at": None,
            "notes": None,
            "order_id": order.id,
        }
        entry = FinanceEntryRepository.create(db, order.organization_id, values)
        _audit(db, order.organization_id, actor_id, "entry_created", entry.id, values)
        entries.append(entry)
    return entries


def _linked_entries(db: Session, order: Order, status: str) -> list[FinanceEntry]:
    return list(
        db.scalars(
            select(FinanceEntry)
            .where(
                FinanceEntry.organization_id == order.organization_id,
                FinanceEntry.order_id == order.id,
                FinanceEntry.status == status,
            )
            .order_by(FinanceEntry.due_date, FinanceEntry.id)
            .with_for_update()
        )
    )


def _change_status(db, entry: FinanceEntry, actor_id, status: str) -> None:
    before = {"status": entry.status}
    entry.status = status
    entry.version += 1
    _audit(
        db,
        entry.organization_id,
        actor_id,
        "entry_updated",
        entry.id,
        {"before": before, "after": {"status": status}, "version": entry.version},
    )


def cancel_order_receivables(db: Session, order: Order, actor_id) -> int:
    """Pedido cancelado: as parcelas ainda não recebidas são canceladas.

    Parcelas já recebidas ficam como estão; a devolução ao cliente é tratada
    à parte no Financeiro.
    """
    entries = _linked_entries(db, order, "pending")
    for entry in entries:
        _change_status(db, entry, actor_id, "cancelled")
    db.flush()
    return len(entries)


def reopen_order_receivables(db: Session, order: Order, actor_id) -> int:
    """Pedido reativado: as parcelas canceladas voltam a ficar pendentes.

    Pedidos antigos, criados antes das contas a receber automáticas, não têm
    parcelas ligadas e continuam sem elas.
    """
    entries = _linked_entries(db, order, "cancelled")
    for entry in entries:
        _change_status(db, entry, actor_id, "pending")
    db.flush()
    return len(entries)


def detach_order_receivables(db: Session, order: Order, actor_id) -> None:
    """Pedido excluído: cancela o que estava pendente e desfaz o vínculo.

    O histórico financeiro permanece; só deixa de apontar para o pedido.
    """
    cancel_order_receivables(db, order, actor_id)
    for entry in db.scalars(
        select(FinanceEntry).where(
            FinanceEntry.organization_id == order.organization_id,
            FinanceEntry.order_id == order.id,
        )
    ):
        entry.order_id = None
    db.flush()
