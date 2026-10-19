import type { CopilotMessage } from './copilotTypes';

export type CopilotSuggestion = {
  title: string;
  description: string;
  prompt: string;
};

export const COPILOT_SUGGESTIONS: CopilotSuggestion[] = [
  {
    title: 'Prioridades do dia',
    description: 'Veja o que precisa da sua atenção.',
    prompt: 'O que precisa da minha atenção hoje?',
  },
  {
    title: 'Pedidos em produção',
    description: 'Consulte os pedidos que estão em preparo.',
    prompt: 'Quais pedidos estão em produção?',
  },
  {
    title: 'Estoque crítico',
    description: 'Identifique produtos que precisam de reposição.',
    prompt: 'Quais produtos estão com estoque crítico?',
  },
  {
    title: 'Orçamentos',
    description: 'Encontre propostas que precisam de acompanhamento.',
    prompt: 'Quais orçamentos precisam de acompanhamento?',
  },
  {
    title: 'Situação fiscal',
    description: 'Confira documentos fiscais que exigem atenção.',
    prompt: 'Quais notas fiscais exigem atenção?',
  },
  {
    title: 'Disponibilidade',
    description: 'Veja o que pode ser produzido com o estoque atual.',
    prompt: 'O que posso produzir com o estoque atual?',
  },
  {
    title: 'Vendas do dia',
    description: 'Acompanhe o resultado comercial de hoje.',
    prompt: 'Quanto vendemos hoje?',
  },
  {
    title: 'Principais clientes',
    description: 'Consulte os clientes com maior relacionamento.',
    prompt: 'Quais são os nossos principais clientes?',
  },
  {
    title: 'Equipe ativa',
    description: 'Consulte a quantidade atual de funcionários.',
    prompt: 'Quantos funcionários ativos temos?',
  },
  {
    title: 'Centros de custo',
    description: 'Entenda a distribuição das áreas internas.',
    prompt: 'Como estão distribuídos os centros de custo?',
  },
];

export const WELCOME_MESSAGE: CopilotMessage = {
  id: 'welcome',
  role: 'assistant',
  text:
    'Olá! Sou o Copiloto GestorIA. Posso consultar pedidos em preparo e orientar você pelos demais módulos sem inventar informações.',
};