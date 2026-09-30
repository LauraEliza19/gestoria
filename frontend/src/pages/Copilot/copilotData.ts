import type { CopilotMessage, CopilotSuggestion } from './copilotTypes'

export const COPILOT_HISTORY_KEY = 'gestoria_copilot_history'

export const COPILOT_SUGGESTIONS: CopilotSuggestion[] = [
  [
    'Prioridades do dia',
    'Veja pedidos, estoque e orçamentos importantes.',
    'O que precisa da minha atenção hoje?',
  ],
  [
    'Estoque crítico',
    'Identifique produtos que precisam de reposição.',
    'Quais produtos estão com estoque crítico?',
  ],
  ['Pedidos em produção', 'Acompanhe o andamento da operação.', 'Quais pedidos estão em produção?'],
  [
    'Orçamentos',
    'Encontre propostas próximas do vencimento.',
    'Quais orçamentos precisam de acompanhamento?',
  ],
]

export const WELCOME_MESSAGE: CopilotMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Olá! Sou a IA da GestorIA. Pergunte sobre sua empresa, prioridades, estoque, pedidos ou orçamentos.',
}
