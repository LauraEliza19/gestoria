import type { CopilotMessage, CopilotSuggestion } from './copilotTypes'

export const COPILOT_HISTORY_KEY = 'gestoria_copilot_history'

export const COPILOT_SUGGESTIONS: CopilotSuggestion[] = [
  [
    'Prioridades do dia',
    'Veja os assuntos que precisam da sua atenção.',
    'O que precisa da minha atenção hoje?',
  ],
  [
    'Pedidos em produção',
    'Consulte pedidos que ainda estão em preparo.',
    'Quais pedidos estão em produção?',
  ],
  [
    'Estoque crítico',
    'Identifique produtos que precisam de reposição.',
    'Quais produtos estão com estoque crítico?',
  ],
  [
    'Orçamentos',
    'Encontre propostas que precisam de acompanhamento.',
    'Quais orçamentos precisam de acompanhamento?',
  ],
  [
    'Situação fiscal',
    'Confira documentos fiscais que exigem atenção.',
    'Quais notas fiscais exigem atenção?',
  ],
  [
    'Disponibilidade',
    'Veja o que pode ser produzido com o estoque atual.',
    'O que posso produzir com o estoque atual?',
  ],
  ['Vendas do dia', 'Acompanhe o resultado comercial de hoje.', 'Quanto vendemos hoje?'],
  [
    'Principais clientes',
    'Consulte os clientes com maior relacionamento.',
    'Quais são os nossos principais clientes?',
  ],
  [
    'Equipe ativa',
    'Consulte a quantidade atual de funcionários.',
    'Quantos funcionários ativos temos?',
  ],
  [
    'Centros de custo',
    'Entenda a distribuição das áreas internas.',
    'Como estão distribuídos os centros de custo?',
  ],
]

export const WELCOME_MESSAGE: CopilotMessage = {
  id: 'welcome',
  role: 'assistant',
  text:
    'Olá! Sou o Copiloto GestorIA. Posso consultar pedidos em preparo e orientar você ' +
    'pelos demais módulos sem inventar informações.',
}
