import type { FiscalDraftItem, FiscalFormState } from './fiscalTypes'

export const FISCAL_STATUSES = [
  'Autorizada',
  'Em processamento',
  'Cancelada',
  'Rejeitada',
  'Inutilizada',
  'Denegada',
]

export const FISCAL_ACTION_NAMES: Record<string, string> = {
  created: 'Registro criado',
  status_changed: 'Situação atualizada',
  stock_received: 'Estoque recebido',
  legacy_order_linked: 'Pedido conciliado',
}

export const FISCAL_STATUS_META: Record<
  string,
  { label: string; tone: 'processing' | 'success' | 'danger' | 'warning' | 'neutral'; description: string }
> = {
  'Em processamento': {
    label: 'Em processamento',
    tone: 'processing',
    description: 'Documento aguardando retorno da autorização fiscal.',
  },
  Autorizada: {
    label: 'Autorizada',
    tone: 'success',
    description: 'Documento autorizado e válido para a operação registrada.',
  },
  Rejeitada: {
    label: 'Rejeitada',
    tone: 'danger',
    description: 'A autorização foi rejeitada e precisa de correção ou novo processamento.',
  },
  Cancelada: {
    label: 'Cancelada',
    tone: 'neutral',
    description: 'Documento cancelado. O histórico da operação permanece disponível.',
  },
  Inutilizada: {
    label: 'Inutilizada',
    tone: 'warning',
    description: 'Numeração inutilizada para emissão fiscal.',
  },
  Denegada: {
    label: 'Denegada',
    tone: 'danger',
    description: 'Documento denegado pelo processo fiscal externo.',
  },
}

export function fiscalStatusMeta(status: string) {
  return (
    FISCAL_STATUS_META[status] ?? {
      label: status || 'Não informado',
      tone: 'neutral' as const,
      description: 'Situação registrada no documento fiscal.',
    }
  )
}

export function fiscalStatusClass(status: string): string {
  return `fiscal-status-badge fiscal-status-${fiscalStatusMeta(status).tone}`
}

export function isActiveFiscalStatus(status: string): boolean {
  return ['Autorizada', 'Em processamento'].includes(status)
}

export function formatFiscalMoney(value: string): string {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatFiscalDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('pt-BR') : 'Não registrado'
}

export function createEmptyFiscalForm(): FiscalFormState {
  return {
    document_type: 'saida',
    order_id: '',
    supplier_id: '',
    number: '',
    series: '1',
    model: '55',
    issue_date: new Date().toISOString().slice(0, 10),
    cfop: '',
    operation_nature: '',
    access_key: '',
  }
}

export function createEmptyFiscalItem(): FiscalDraftItem {
  return {
    product_id: '',
    quantity: '1',
    unit_price: '0.00',
  }
}
