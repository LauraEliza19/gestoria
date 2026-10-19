import unicodedata
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.repositories import CopilotRepository
from app.schemas.copilot import (
    CopilotActionRead,
    CopilotChatResponse,
    CopilotConfirmationRead,
    CopilotIntent,
    CopilotItemRead,
    CopilotToolRead,
)

GUIDED_RESPONSES: dict[CopilotIntent, tuple[str, str, str, str]] = {
    "daily_priorities": (
        (
            "A consulta automática de prioridades ainda não está disponível. "
            "Use a visão geral para acompanhar os principais indicadores."
        ),
        "open-dashboard",
        "Abrir visão geral",
        "/dashboard",
    ),
    "critical_stock": (
        (
            "A consulta automática de estoque crítico ainda não está disponível. "
            "Confira os saldos e alertas no cadastro de produtos."
        ),
        "open-products",
        "Abrir produtos",
        "/produtos",
    ),
    "quotes_follow_up": (
        (
            "A consulta automática de orçamentos ainda não está disponível. "
            "Confira propostas pendentes e seus vencimentos no módulo de orçamentos."
        ),
        "open-quotes",
        "Abrir orçamentos",
        "/orcamentos",
    ),
    "fiscal_attention": (
        (
            "A consulta automática fiscal ainda não está disponível. "
            "Confira documentos em processamento ou rejeitados no módulo fiscal."
        ),
        "open-fiscal",
        "Abrir notas fiscais",
        "/notas-fiscais",
    ),
    "production_availability": (
        (
            "A consulta automática de disponibilidade ainda não está disponível no Copiloto. "
            "O painel de produção mostra receitas disponíveis e insumos faltantes."
        ),
        "open-production",
        "Abrir modo produção",
        "/modo-fabrica",
    ),
    "sales_today": (
        (
            "A consulta automática de vendas do dia ainda não está disponível. "
            "Use a visão geral para acompanhar os resultados da operação."
        ),
        "open-dashboard",
        "Abrir visão geral",
        "/dashboard",
    ),
    "top_customers": (
        (
            "A consulta automática dos principais clientes ainda não está disponível. "
            "Acesse clientes para consultar históricos e valores."
        ),
        "open-customers",
        "Abrir clientes",
        "/clientes",
    ),
    "active_employees": (
        (
            "A consulta automática de funcionários ainda não está disponível. "
            "Use a Gestão Interna para consultar a equipe."
        ),
        "open-employees",
        "Abrir funcionários",
        "/gestao/funcionarios",
    ),
    "cost_centers_summary": (
        (
            "A consulta automática de centros de custo ainda não está disponível. "
            "Use a Gestão Interna para consultar as áreas cadastradas."
        ),
        "open-cost-centers",
        "Abrir centros de custo",
        "/gestao/centros-de-custo",
    ),
}

MANAGEMENT_INTENTS = {
    "active_employees",
    "cost_centers_summary",
}


def normalize_prompt(message: str) -> str:
    decomposed = unicodedata.normalize("NFD", message.casefold())
    without_accents = "".join(
        character for character in decomposed if not unicodedata.combining(character)
    )
    return " ".join(without_accents.split())


def recognize_intent(message: str) -> CopilotIntent:
    prompt = normalize_prompt(message)

    if "pedido" in prompt and any(
        word in prompt for word in ("producao", "preparo", "andamento")
    ):
        return "orders_in_preparation"

    if "estoque" in prompt and any(
        word in prompt for word in ("critico", "baixo", "reposicao", "repor")
    ):
        return "critical_stock"

    if any(word in prompt for word in ("orcamento", "orcamentos", "proposta")):
        return "quotes_follow_up"

    if any(word in prompt.split() for word in ("fiscal", "fiscais")):
        return "fiscal_attention"

    if any(word in prompt for word in ("produzir", "preparar")) and any(
        word in prompt for word in ("estoque", "insumo", "ingrediente")
    ):
        return "production_availability"

    if any(word in prompt for word in ("venda", "vendas", "vendemos", "faturamento")):
        return "sales_today"

    if "cliente" in prompt and any(
        word in prompt for word in ("principal", "principais", "maior", "melhor", "top")
    ):
        return "top_customers"

    if any(word in prompt for word in ("funcionario", "funcionarios", "colaborador")):
        return "active_employees"

    if "centro" in prompt and "custo" in prompt:
        return "cost_centers_summary"

    if "atencao" in prompt and any(word in prompt for word in ("hoje", "dia")):
        return "daily_priorities"

    return "unknown"


def format_currency(value: Decimal) -> str:
    formatted = f"{value:,.2f}"
    localized = formatted.replace(",", "_").replace(".", ",").replace("_", ".")
    return f"R$ {localized}"


def build_action(
    action_id: str,
    label: str,
    path: str,
) -> CopilotActionRead:
    return CopilotActionRead(
        id=action_id,
        label=label,
        path=path,
        requires_confirmation=False,
    )


def build_response(
    *,
    intent: CopilotIntent,
    status: str,
    message: str,
    tool: CopilotToolRead | None = None,
    items: list[CopilotItemRead] | None = None,
    actions: list[CopilotActionRead] | None = None,
    confirmation: CopilotConfirmationRead | None = None,
) -> CopilotChatResponse:
    return CopilotChatResponse(
        message_id=uuid.uuid4(),
        status=status,
        intent=intent,
        message=message,
        tool=tool,
        items=items or [],
        actions=actions or [],
        confirmation=confirmation,
        generated_at=datetime.now(timezone.utc),
    )


def answer_orders_in_preparation(
    db: Session,
    organization_id: uuid.UUID,
) -> CopilotChatResponse:
    total, orders = CopilotRepository.list_orders_in_preparation(
        db,
        organization_id,
    )

    items = [
        CopilotItemRead(
            id=order.id,
            title=order.customer.name,
            description=(
                f"Pedido {str(order.id)[:8].upper()} · "
                f"{format_currency(order.total_amount)} · "
                f"{order.created_at.strftime('%d/%m/%Y %H:%M')}"
            ),
            path="/pedidos",
        )
        for order in orders
    ]

    if total == 0:
        message = "Não há pedidos em preparo neste momento."
        tool_status = "empty"
    elif total == 1:
        message = "Existe 1 pedido em preparo."
        tool_status = "success"
    else:
        message = f"Existem {total} pedidos em preparo."
        tool_status = "success"

    return build_response(
        intent="orders_in_preparation",
        status="answered",
        message=message,
        tool=CopilotToolRead(
            name="orders_in_preparation",
            status=tool_status,
        ),
        items=items,
        actions=[
            build_action(
                "open-orders",
                "Abrir pedidos",
                "/pedidos",
            )
        ],
    )


def answer_guided_intent(
    intent: CopilotIntent,
    role: str,
) -> CopilotChatResponse:
    if intent in MANAGEMENT_INTENTS and role not in {"owner", "admin"}:
        return build_response(
            intent=intent,
            status="guided",
            message=(
                "Esta consulta pertence à Gestão Interna e exige permissão "
                "de proprietário ou administrador."
            ),
        )

    message, action_id, action_label, path = GUIDED_RESPONSES[intent]

    return build_response(
        intent=intent,
        status="guided",
        message=message,
        actions=[
            build_action(
                action_id,
                action_label,
                path,
            )
        ],
    )


def answer_copilot(
    db: Session,
    organization_id: uuid.UUID,
    role: str,
    message: str,
) -> CopilotChatResponse:
    intent = recognize_intent(message)

    if intent == "orders_in_preparation":
        return answer_orders_in_preparation(
            db,
            organization_id,
        )

    if intent in GUIDED_RESPONSES:
        return answer_guided_intent(intent, role)

    return build_response(
        intent="unknown",
        status="guided",
        message=(
            "Ainda não reconheço essa pergunta. Posso orientar consultas sobre "
            "pedidos, estoque, orçamentos, notas fiscais, produção, vendas, "
            "clientes, funcionários e centros de custo."
        ),
        actions=[
            build_action(
                "open-dashboard",
                "Abrir visão geral",
                "/dashboard",
            )
        ],
    )
