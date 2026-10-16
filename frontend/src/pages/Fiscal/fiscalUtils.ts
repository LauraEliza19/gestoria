import type {
  FiscalDocument,
  FiscalDraftItem,
  FiscalFormState,
  FiscalOrganization,
  FiscalParty,
  FiscalSort,
} from './fiscalTypes'

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
  {
    label: string
    tone: 'processing' | 'success' | 'danger' | 'warning' | 'neutral'
    description: string
  }
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

export const FISCAL_MODEL_NAMES: Record<string, string> = {
  '55': 'NF-e',
  '65': 'NFC-e',
  'NFS-e': 'NFS-e',
}

export const FISCAL_SNAPSHOT_LABELS: Record<string, string> = {
  legacy_unverified: 'Histórico pendente de conciliação',
  reconciled_order: 'Conciliado com pedido',
}

export function formatFiscalDate(value: string | null | undefined): string {
  if (!value) {
    return 'Não informado'
  }

  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

// Para data e hora completas (ISO): usa o fuso do navegador, igual ao horário exibido.
export function formatFiscalDay(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('pt-BR') : 'Não informado'
}

export function formatFiscalTime(value: string | null | undefined): string {
  return value
    ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : ''
}

export function formatRelativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) {
    return ''
  }

  const minutes = Math.round((now - new Date(value).getTime()) / 60000)

  if (minutes < 1) return 'agora mesmo'
  if (minutes < 60) return `há ${minutes} minuto${minutes === 1 ? '' : 's'}`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours} hora${hours === 1 ? '' : 's'}`

  const days = Math.round(hours / 24)
  if (days < 30) return `há ${days} dia${days === 1 ? '' : 's'}`

  const months = Math.round(days / 30)
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`

  const years = Math.round(months / 12)
  return `há ${years} ano${years === 1 ? '' : 's'}`
}

export function formatTaxId(value: string | null | undefined): string {
  if (!value) {
    return 'Não informado'
  }

  const digits = value.replace(/\D/g, '')

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  return value
}

export function formatAccessKey(value: string | null | undefined): string {
  return value ? value.replace(/(\d{4})(?=\d)/g, '$1 ') : 'Não informada'
}

export function formatQuantity(value: string): string {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

export function fiscalItemTotal(item: { quantity: string; unit_price: string; total?: string }) {
  return item.total !== undefined
    ? Number(item.total)
    : Number(item.quantity) * Number(item.unit_price)
}

export function organizationParty(organization: FiscalOrganization | undefined): FiscalParty {
  return {
    name: organization?.name || 'Sua empresa',
    document: organization?.document || null,
  }
}

export function fiscalParties(document: FiscalDocument, organization?: FiscalOrganization) {
  const company = organizationParty(organization)
  const participant: FiscalParty = {
    name: document.participant_name,
    document: document.participant_document,
  }

  return document.document_type === 'saida'
    ? { emitter: company, recipient: participant }
    : { emitter: participant, recipient: company }
}

export function lastFiscalIteration(document: FiscalDocument): string {
  const dates = [
    document.created_at,
    document.updated_at,
    document.authorized_at,
    document.cancelled_at,
    document.stock_received_at,
    document.reconciled_at,
    ...document.events.map((event) => event.created_at),
  ].filter((value): value is string => Boolean(value))

  return dates.reduce((latest, value) => (value > latest ? value : latest), dates[0] || '')
}

export type FiscalStepState = 'done' | 'processing' | 'failed' | 'warning' | 'cancelled' | 'idle'

export type FiscalStep = {
  key: string
  label: string
  state: FiscalStepState
  detail: string
}

export function fiscalSteps(document: FiscalDocument): FiscalStep[] {
  const status = document.status
  const authorizedBefore = Boolean(document.authorized_at) || status === 'Autorizada'

  let authorization: FiscalStep = {
    key: 'authorization',
    label: 'Autorização',
    state: 'idle',
    detail: 'Sem autorização registrada',
  }

  if (authorizedBefore) {
    authorization = {
      ...authorization,
      state: 'done',
      detail: `Autorizada em ${formatFiscalDateTime(document.authorized_at)}`,
    }
  } else if (status === 'Em processamento') {
    authorization = { ...authorization, state: 'processing', detail: 'Aguardando retorno' }
  } else if (status === 'Rejeitada' || status === 'Denegada') {
    authorization = { ...authorization, state: 'failed', detail: status }
  } else if (status === 'Inutilizada') {
    authorization = { ...authorization, state: 'warning', detail: 'Numeração inutilizada' }
  }

  const cancellation: FiscalStep = {
    key: 'cancellation',
    label: 'Cancelamento',
    state: status === 'Cancelada' ? 'cancelled' : 'idle',
    detail:
      status === 'Cancelada'
        ? `Cancelada em ${formatFiscalDateTime(document.cancelled_at)}`
        : 'Sem cancelamento',
  }

  const complement: FiscalStep =
    document.document_type === 'entrada'
      ? {
          key: 'stock',
          label: 'Estoque',
          state: document.stock_received_at ? 'done' : 'idle',
          detail: document.stock_received_at
            ? `Recebido em ${formatFiscalDateTime(document.stock_received_at)}`
            : 'Recebimento não confirmado',
        }
      : {
          key: 'order',
          label: 'Pedido',
          state: document.order_id ? 'done' : 'idle',
          detail: document.order_id ? 'Vinculada a um pedido de venda' : 'Sem pedido vinculado',
        }

  return [
    {
      key: 'registered',
      label: 'Registro',
      state: 'done',
      detail: `Registrada em ${formatFiscalDateTime(document.created_at)}`,
    },
    authorization,
    cancellation,
    complement,
  ]
}

export function sortFiscalDocuments(
  documents: FiscalDocument[],
  sort: FiscalSort,
  organization?: FiscalOrganization,
): FiscalDocument[] {
  const factor = sort.direction === 'asc' ? 1 : -1

  const valueOf = (document: FiscalDocument): string | number => {
    const parties = fiscalParties(document, organization)

    switch (sort.key) {
      case 'emitter':
        return parties.emitter.name.toLowerCase()
      case 'recipient':
        return parties.recipient.name.toLowerCase()
      case 'number':
        return Number(document.number) || 0
      case 'value':
        return Number(document.value)
      case 'updated_at':
        return lastFiscalIteration(document)
      default:
        return `${document.issue_date} ${document.created_at}`
    }
  }

  return [...documents].sort((first, second) => {
    const a = valueOf(first)
    const b = valueOf(second)
    return (a < b ? -1 : a > b ? 1 : 0) * factor
  })
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildFiscalCsv(documents: FiscalDocument[], organization?: FiscalOrganization) {
  const header = [
    'Tipo',
    'Número',
    'Série',
    'Modelo',
    'Emissão',
    'Emitente',
    'CPF/CNPJ emitente',
    'Destinatário',
    'CPF/CNPJ destinatário',
    'Valor',
    'Status',
    'Chave de acesso',
    'Protocolo de autorização',
  ]

  const rows = documents.map((document) => {
    const { emitter, recipient } = fiscalParties(document, organization)

    return [
      document.document_type === 'saida' ? 'Saída' : 'Entrada',
      document.number,
      document.series,
      FISCAL_MODEL_NAMES[document.model] || document.model,
      formatFiscalDate(document.issue_date),
      emitter.name,
      emitter.document,
      recipient.name,
      recipient.document,
      Number(document.value).toFixed(2).replace('.', ','),
      document.status,
      document.access_key,
      document.authorization_protocol,
    ]
  })

  return [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob(['\ufeff', content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
