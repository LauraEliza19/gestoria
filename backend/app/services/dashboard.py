from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.repositories import DashboardRepository
from app.schemas import (
    DashboardAlertRead,
    DashboardOverviewRead,
    DashboardSummaryRead,
)
from app.services.auth import AuthenticatedUser
from app.services.production import overview as production_overview

BUSINESS_TIMEZONE = ZoneInfo("America/Sao_Paulo")
QUOTE_EXPIRATION_WINDOW_DAYS = 7


def count_message(count: int, singular: str, plural: str) -> str:
    return f"{count} {singular if count == 1 else plural}"


def build_dashboard_overview(
    db: Session,
    current: AuthenticatedUser,
) -> DashboardOverviewRead:
    now_local = datetime.now(BUSINESS_TIMEZONE)
    today = now_local.date()

    sales_start = now_local.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    sales_end = sales_start + timedelta(days=1)
    quote_expiration_limit = today + timedelta(days=QUOTE_EXPIRATION_WINDOW_DAYS)

    include_management = current.membership.role in {"owner", "admin"}

    snapshot = DashboardRepository.get_snapshot(
        db,
        current.organization.id,
        sales_start=sales_start.astimezone(UTC),
        sales_end=sales_end.astimezone(UTC),
        today=today,
        quote_expiration_limit=quote_expiration_limit,
        include_management=include_management,
    )

    production = production_overview(
        db,
        current.organization.id,
    )
    blocked_recipes = sum(recipe.max_batches == 0 for recipe in production.recipes)

    alerts: list[DashboardAlertRead] = []

    if snapshot.critical_stock_items:
        alerts.append(
            DashboardAlertRead(
                id="critical-stock",
                module="products",
                severity="critical",
                title="Estoque crítico",
                description=count_message(
                    snapshot.critical_stock_items,
                    "produto chegou ao limite de reposição.",
                    "produtos chegaram ao limite de reposição.",
                ),
                impact=(
                    "Vendas e produção podem ser interrompidas "
                    "se o estoque não for reposto."
                ),
                occurred_at=snapshot.stock_latest_at,
                source="Produtos e estoque",
                action_label="Ver produtos",
                action_route="/products",
                count=snapshot.critical_stock_items,
            )
        )

    if blocked_recipes:
        alerts.append(
            DashboardAlertRead(
                id="blocked-production",
                module="production",
                severity="critical",
                title="Produção bloqueada",
                description=count_message(
                    blocked_recipes,
                    "receita não pode ser produzida com o estoque atual.",
                    "receitas não podem ser produzidas com o estoque atual.",
                ),
                impact=(
                    "Pedidos podem atrasar até que os insumos "
                    "necessários sejam repostos."
                ),
                occurred_at=None,
                source="Produção e receitas",
                action_label="Ver produção",
                action_route="/production",
                count=blocked_recipes,
            )
        )

    if snapshot.fiscal_attention:
        alerts.append(
            DashboardAlertRead(
                id="fiscal-attention",
                module="fiscal",
                severity="warning",
                title="Documentos fiscais exigem atenção",
                description=count_message(
                    snapshot.fiscal_attention,
                    "documento está pendente ou com problema.",
                    "documentos estão pendentes ou com problema.",
                ),
                impact=("A operação fiscal deve ser conferida antes de prosseguir."),
                occurred_at=snapshot.fiscal_latest_at,
                source="Módulo fiscal",
                action_label="Ver documentos",
                action_route="/fiscal",
                count=snapshot.fiscal_attention,
            )
        )

    if snapshot.expired_quotes:
        alerts.append(
            DashboardAlertRead(
                id="expired-quotes",
                module="quotes",
                severity="warning",
                title="Orçamentos vencidos",
                description=count_message(
                    snapshot.expired_quotes,
                    "orçamento está fora da validade.",
                    "orçamentos estão fora da validade.",
                ),
                impact=(
                    "O cliente pode estar aguardando uma revisão "
                    "ou novo contato comercial."
                ),
                occurred_at=snapshot.quotes_latest_at,
                source="Orçamentos",
                action_label="Ver orçamentos",
                action_route="/quotes",
                count=snapshot.expired_quotes,
            )
        )

    if snapshot.open_employee_records:
        alerts.append(
            DashboardAlertRead(
                id="open-employee-records",
                module="management",
                severity="warning",
                title="Ocorrências de funcionários abertas",
                description=count_message(
                    snapshot.open_employee_records,
                    "ocorrência aguarda tratamento.",
                    "ocorrências aguardam tratamento.",
                ),
                impact=("Há registros internos que ainda precisam de acompanhamento."),
                occurred_at=snapshot.employee_records_latest_at,
                source="Gestão interna",
                action_label="Ver ocorrências",
                action_route="/management",
                count=snapshot.open_employee_records,
            )
        )

    if snapshot.expiring_quotes:
        alerts.append(
            DashboardAlertRead(
                id="expiring-quotes",
                module="quotes",
                severity="info",
                title="Orçamentos próximos do vencimento",
                description=count_message(
                    snapshot.expiring_quotes,
                    "orçamento vence nos próximos sete dias.",
                    "orçamentos vencem nos próximos sete dias.",
                ),
                impact=("Um contato antecipado pode aumentar a chance de conversão."),
                occurred_at=snapshot.quotes_latest_at,
                source="Orçamentos",
                action_label="Acompanhar orçamentos",
                action_route="/quotes",
                count=snapshot.expiring_quotes,
            )
        )

    if snapshot.orders_in_preparation:
        alerts.append(
            DashboardAlertRead(
                id="orders-in-preparation",
                module="orders",
                severity="info",
                title="Pedidos em andamento",
                description=count_message(
                    snapshot.orders_in_preparation,
                    "pedido está em preparação.",
                    "pedidos estão em preparação.",
                ),
                impact=("Acompanhe o andamento para evitar atrasos na entrega."),
                occurred_at=snapshot.orders_latest_at,
                source="Pedidos",
                action_label="Ver pedidos",
                action_route="/orders",
                count=snapshot.orders_in_preparation,
            )
        )

    severities = {alert.severity for alert in alerts}

    if "critical" in severities:
        health = "critical"
    elif "warning" in severities:
        health = "attention"
    else:
        health = "healthy"

    return DashboardOverviewRead(
        generated_at=now_local.astimezone(UTC),
        health=health,
        summary=DashboardSummaryRead(
            sales_today=snapshot.sales_today,
            orders_in_preparation=snapshot.orders_in_preparation,
            blocked_recipes=blocked_recipes,
            critical_stock_items=snapshot.critical_stock_items,
            fiscal_attention=snapshot.fiscal_attention,
            active_employees=snapshot.active_employees,
            open_employee_records=snapshot.open_employee_records,
            financial_balance=None,
            financial_available=False,
            management_available=include_management,
        ),
        alerts=alerts,
    )
