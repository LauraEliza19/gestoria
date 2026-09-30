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
