import time
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from types import MappingProxyType

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.repositories import CopilotRepository
from app.schemas.copilot import (
    CopilotActionRead,
    CopilotAuditStatus,
    CopilotAuditWrite,
    CopilotChatResponse,
    CopilotConfirmationRead,
    CopilotIntent,
    CopilotItemRead,
    CopilotNoArguments,
    CopilotOrdersArguments,
    CopilotOrdersResult,
    CopilotProviderRequest,
    CopilotProviderResponse,
    CopilotToolRead,
)
from app.services.copilot_audit import record_tool_audit
from app.services.copilot_provider import GUIDED_RESPONSES, CopilotAIProvider
from app.services.copilot_rate_limit import consume_copilot_request


@dataclass(frozen=True)
class CopilotToolDefinition:
    arguments_schema: type[CopilotNoArguments] | type[CopilotOrdersArguments]
    requires_admin: bool = False


# Closed policy registry. A provider cannot select or register a tool, invent
# arguments, change roles or supply organization_id. Unknown prompts only guide.
COPILOT_TOOLS = MappingProxyType(
    {
        "daily_priorities": CopilotToolDefinition(CopilotNoArguments),
        "orders_in_preparation": CopilotToolDefinition(CopilotOrdersArguments),
        "critical_stock": CopilotToolDefinition(CopilotNoArguments),
        "quotes_follow_up": CopilotToolDefinition(CopilotNoArguments),
        "fiscal_attention": CopilotToolDefinition(CopilotNoArguments),
        "production_availability": CopilotToolDefinition(CopilotNoArguments),
        "sales_today": CopilotToolDefinition(CopilotNoArguments, requires_admin=True),
        "top_customers": CopilotToolDefinition(CopilotNoArguments),
        "active_employees": CopilotToolDefinition(
            CopilotNoArguments, requires_admin=True
        ),
        "cost_centers_summary": CopilotToolDefinition(
            CopilotNoArguments, requires_admin=True
        ),
    }
)


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


def _reject_secret_output(response: CopilotChatResponse) -> None:
    secret = settings.copilot_api_key.get_secret_value()

    def contains_secret(value):
        if isinstance(value, str):
            return secret in value
        if isinstance(value, dict):
            return any(contains_secret(item) for item in value.values())
        if isinstance(value, list | tuple):
            return any(contains_secret(item) for item in value)
        return False

    if secret and contains_secret(response.model_dump(mode="json")):
        raise ValueError("Resposta do provedor recusada.")


def answer_copilot(
    db: Session,
    organization_id: uuid.UUID,
    role: str,
    message: str,
    *,
    user_id: uuid.UUID,
    provider: CopilotAIProvider,
) -> CopilotChatResponse:
    started = time.perf_counter()
    intent = recognize_intent(message)
    definition = COPILOT_TOOLS.get(intent)
    arguments = definition.arguments_schema() if definition else CopilotNoArguments()

    def audit(status: CopilotAuditStatus) -> None:
        record_tool_audit(
            db,
            organization_id=organization_id,
            user_id=user_id,
            entry=CopilotAuditWrite(
                question_id=intent,
                tool_name=intent,
                input_payload=arguments,
                status=status,
                execution_time_ms=min(
                    2147483647, max(0, int((time.perf_counter() - started) * 1000))
                ),
            ),
        )

    try:
        consume_copilot_request(db, organization_id=organization_id, user_id=user_id)
    except HTTPException as exc:
        if exc.status_code != 429:
            raise
        audit("rate_limited")
        raise
    except Exception:  # noqa: BLE001 -- fail closed without leaking plugin/DB errors
        db.rollback()
        audit("error")
        raise HTTPException(
            503, "Copiloto indisponível. Tente novamente mais tarde."
        ) from None

    if definition and definition.requires_admin and role not in {"owner", "admin"}:
        audit("denied")
        raise HTTPException(
            403,
            "Esta consulta exige permissão de proprietário ou administrador.",
        )

    try:
        items = []
        tool = None
        order_count = None
        if intent == "orders_in_preparation" and intent in COPILOT_TOOLS:
            # Validate tool inputs before touching the repository, then validate
            # its output before constructing either provider or HTTP payloads.
            tool_arguments = CopilotOrdersArguments.model_validate(arguments)
            result = CopilotOrdersResult.model_validate(
                CopilotRepository.list_orders_in_preparation(
                    db, organization_id=organization_id, arguments=tool_arguments
                )
            )
            order_count = result.total
            items = [
                CopilotItemRead(
                    id=order.id,
                    title=order.customer_name,
                    description=(
                        f"Pedido {str(order.id)[:8].upper()} · "
                        f"{format_currency(order.total_amount)} · "
                        f"{order.created_at.strftime('%d/%m/%Y %H:%M')}"
                    ),
                    path="/pedidos",
                )
                for order in result.orders
            ]
            tool = CopilotToolRead(
                name="orders_in_preparation",
                status="empty" if result.total == 0 else "success",
            )
            action = ("open-orders", "Abrir pedidos", "/pedidos")
        elif intent in COPILOT_TOOLS and intent in GUIDED_RESPONSES:
            action = GUIDED_RESPONSES[intent][1:]
        else:
            intent = "unknown"
            action = ("open-dashboard", "Abrir visão geral", "/dashboard")

        context = CopilotProviderRequest(intent=intent, order_count=order_count)
        presentation = CopilotProviderResponse.model_validate(
            provider.generate_response(context)
        )
        response = build_response(
            intent=intent,
            status="answered" if tool else "guided",
            message=presentation.message,
            tool=tool,
            items=items,
            actions=[build_action(*action)],
        )
        _reject_secret_output(response)
    except Exception:  # noqa: BLE001 -- fail closed without leaking plugin/DB errors
        # Roll back failed database work before writing a durable error event.
        # Never persist the prompt, provider output, SQL or exception text.
        db.rollback()
        audit("error")
        raise HTTPException(
            503, "Copiloto indisponível. Tente novamente mais tarde."
        ) from None

    audit("executed")
    return response
