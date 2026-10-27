"""Presentation-only provider. No database, credentials or raw chat inputs."""

from types import MappingProxyType
from typing import Protocol

from app.schemas.copilot import CopilotProviderRequest, CopilotProviderResponse

GUIDED_RESPONSES = MappingProxyType(
    {
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
)


class CopilotAIProvider(Protocol):
    def generate_response(
        self, request: CopilotProviderRequest
    ) -> CopilotProviderResponse:
        """Format an already authorized, validated aggregate without capabilities."""
        ...


class LocalCopilotProvider:
    def generate_response(
        self, request: CopilotProviderRequest
    ) -> CopilotProviderResponse:
        request = CopilotProviderRequest.model_validate(request)
        if request.intent == "orders_in_preparation":
            if request.order_count == 0:
                message = "Não há pedidos em preparo neste momento."
            elif request.order_count == 1:
                message = "Existe 1 pedido em preparo."
            else:
                message = f"Existem {request.order_count} pedidos em preparo."
        elif request.intent in GUIDED_RESPONSES:
            message = GUIDED_RESPONSES[request.intent][0]
        else:
            message = (
                "Ainda não reconheço essa pergunta. Posso orientar consultas sobre "
                "pedidos, estoque, orçamentos, notas fiscais, produção, vendas, "
                "clientes, funcionários e centros de custo."
            )
        return CopilotProviderResponse(message=message)


def get_copilot_provider() -> CopilotAIProvider:
    # COPILOT_PROVIDER currently supports only 'local'; Settings rejects any
    # unimplemented integration at startup instead of silently falling back.
    return LocalCopilotProvider()
