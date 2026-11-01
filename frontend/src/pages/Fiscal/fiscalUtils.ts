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

// ---------------------------------------------------------------------------
// Validação e formatação de documentos (CPF/CNPJ), CEP, telefone e unidades.
// ---------------------------------------------------------------------------

export function onlyDigits(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '')
}

function allSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits)
}

export function isValidCpf(value: string | null | undefined): boolean {
  const digits = onlyDigits(value)

  if (digits.length !== 11 || allSameDigits(digits)) {
    return false
  }

  const checkDigit = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index)
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10])
}

export function isValidCnpj(value: string | null | undefined): boolean {
  const digits = onlyDigits(value)

  if (digits.length !== 14 || allSameDigits(digits)) {
    return false
  }

  const checkDigit = (length: number) => {
    const weights =
      length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  return checkDigit(12) === Number(digits[12]) && checkDigit(13) === Number(digits[13])
}

// Retorna a mensagem de erro do CPF/CNPJ ou string vazia quando o documento é válido.
export function taxIdError(value: string | null | undefined): string {
  const digits = onlyDigits(value)

  if (!digits) {
    return 'Informe o CPF ou CNPJ.'
  }

  if (digits.length !== 11 && digits.length !== 14) {
    return `Quantidade de dígitos inválida (${digits.length}). CPF tem 11 dígitos e CNPJ tem 14.`
  }

  if (digits.length === 11 && !isValidCpf(digits)) {
    return 'CPF inválido: confira os dígitos verificadores.'
  }

  if (digits.length === 14 && !isValidCnpj(digits)) {
    return 'CNPJ inválido: confira os dígitos verificadores.'
  }

  return ''
}

export function isValidTaxId(value: string | null | undefined): boolean {
  return taxIdError(value) === ''
}

// Máscara progressiva para digitação: até 11 dígitos usa CPF, acima disso CNPJ.
export function maskTaxIdInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 14)

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
  }

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function formatCep(value: string | null | undefined): string {
  const digits = onlyDigits(value)
  return digits.length === 8 ? digits.replace(/(\d{5})(\d{3})/, '$1-$2') : value || ''
}

export function formatPhone(value: string | null | undefined): string {
  let digits = onlyDigits(value)

  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2)
  }

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }

  if (digits.length === 9) {
    return digits.replace(/(\d{5})(\d{4})/, '$1-$2')
  }

  if (digits.length === 8) {
    return digits.replace(/(\d{4})(\d{4})/, '$1-$2')
  }

  return value || ''
}

export const FISCAL_UNITS = ['un', 'kg', 'g', 'l'] as const

const UNIT_ALIASES: Record<string, string> = {
  un: 'un',
  und: 'un',
  unid: 'un',
  unit: 'un',
  units: 'un',
  unidade: 'un',
  unidades: 'un',
  pc: 'un',
  pç: 'un',
  peca: 'un',
  peça: 'un',
  kg: 'kg',
  kgs: 'kg',
  quilo: 'kg',
  quilos: 'kg',
  quilograma: 'kg',
  quilogramas: 'kg',
  kilograma: 'kg',
  g: 'g',
  gr: 'g',
  grs: 'g',
  grama: 'g',
  gramas: 'g',
  l: 'l',
  lt: 'l',
  lts: 'l',
  litro: 'l',
  litros: 'l',
}

// Padroniza a unidade de medida para exibição: un, kg, g ou l.
export function formatUnit(value: string | null | undefined): string {
  const key = (value || '').trim().toLowerCase().replace(/\.$/, '')

  if (!key) {
    return 'un'
  }

  return UNIT_ALIASES[key] || key
}

export const FISCAL_UNIT_NAMES: Record<string, string> = {
  un: 'unidade',
  kg: 'quilograma',
  g: 'grama',
  l: 'litro',
}

// ---------------------------------------------------------------------------
// Chave de acesso, CFOP e campos obrigatórios do formulário.
// ---------------------------------------------------------------------------

export const ACCESS_KEY_LENGTH = 44

export function accessKeyError(value: string | null | undefined): string {
  const digits = onlyDigits(value)

  if (!value) {
    return ''
  }

  if (digits.length !== (value || '').length) {
    return 'A chave de acesso deve conter somente números.'
  }

  if (digits.length !== ACCESS_KEY_LENGTH) {
    return `A chave de acesso deve ter 44 dígitos (informados: ${digits.length}).`
  }

  return ''
}

export function cfopError(value: string | null | undefined): string {
  const text = (value || '').trim()

  if (!text) {
    return ''
  }

  return /^[1-7]\.?\d{3}$/.test(text)
    ? ''
    : 'CFOP deve ter 4 dígitos e começar com 1 a 7 (ex.: 5102).'
}

export const CFOP_EXAMPLES = [
  { code: '5102', label: 'Venda de mercadoria adquirida de terceiros (dentro do estado)' },
  { code: '5101', label: 'Venda de produção do estabelecimento (dentro do estado)' },
  { code: '6102', label: 'Venda de mercadoria adquirida de terceiros (fora do estado)' },
  { code: '1102', label: 'Compra para comercialização (dentro do estado)' },
  { code: '5405', label: 'Venda de mercadoria com substituição tributária' },
]

export const OPERATION_NATURE_EXAMPLES = [
  'Venda de mercadoria',
  'Venda de produção do estabelecimento',
  'Compra para comercialização',
  'Devolução de compra',
  'Remessa para conserto',
]

export function fiscalDocumentFormErrors(
  form: FiscalFormState,
  items: FiscalDraftItem[] = [],
): Partial<Record<keyof FiscalFormState | 'items', string>> {
  const errors: Partial<Record<keyof FiscalFormState | 'items', string>> = {}

  if (form.document_type === 'saida' && !form.order_id) {
    errors.order_id = 'Selecione o pedido vinculado.'
  }

  if (form.document_type === 'entrada') {
    if (!form.supplier_id) {
      errors.supplier_id = 'Selecione o fornecedor.'
    }

    const invalidItem = items.some(
      (item) =>
        !item.product_id ||
        !(Number(item.quantity) > 0) ||
        item.unit_price === '' ||
        !(Number(item.unit_price) >= 0),
    )

    if (items.length === 0 || invalidItem) {
      errors.items = 'Informe produto, quantidade e valor unitário de todos os itens.'
    }
  }

  if (!form.number.trim()) errors.number = 'Informe o número da nota.'
  if (!form.series.trim()) errors.series = 'Informe a série.'
  if (!form.issue_date) errors.issue_date = 'Informe a data de emissão.'

  const cfop = cfopError(form.cfop)
  if (cfop) errors.cfop = cfop

  const key = accessKeyError(form.access_key)
  if (key) errors.access_key = key

  return errors
}

// Compara o formulário atual com o estado de quando foi aberto.
export function isFiscalFormDirty(
  form: FiscalFormState,
  baseline: FiscalFormState,
  items: FiscalDraftItem[] = [],
  baselineItems: FiscalDraftItem[] = [],
  supplierDraft: { name: string; document: string } = { name: '', document: '' },
): boolean {
  const changedForm = (Object.keys(baseline) as (keyof FiscalFormState)[]).some(
    (field) => (form[field] ?? '') !== (baseline[field] ?? ''),
  )
  const changedItems = JSON.stringify(items) !== JSON.stringify(baselineItems)
  const changedSupplier = Boolean(supplierDraft.name.trim() || supplierDraft.document.trim())

  return changedForm || changedItems || changedSupplier
}

export const UNSAVED_FORM_MESSAGE =
  'Existem dados não salvos no formulário. Deseja realmente fechar e descartar as alterações?'

// ---------------------------------------------------------------------------
// Eventos fiscais: validação e confirmação de ações irreversíveis.
// ---------------------------------------------------------------------------

export const CRITICAL_FISCAL_STATUSES = ['Cancelada', 'Rejeitada', 'Denegada', 'Inutilizada']

export function fiscalEventNeedsProtocol(status: string, currentStatus: string): boolean {
  return status === 'Autorizada' || (status === 'Cancelada' && currentStatus === 'Autorizada')
}

export function isFiscalEventFormValid(
  form: { status: string; occurred_at: string; protocol: string; reason: string },
  currentStatus: string,
  allowedStatuses?: string[],
): boolean {
  if (!form.status) {
    return false
  }

  if (allowedStatuses && !allowedStatuses.includes(form.status)) {
    return false
  }

  const dated = ['Autorizada', 'Cancelada'].includes(form.status)

  if (dated && !form.occurred_at) {
    return false
  }

  if (fiscalEventNeedsProtocol(form.status, currentStatus) && !form.protocol.trim()) {
    return false
  }

  if (form.protocol.length > 120) {
    return false
  }

  if (form.status === 'Cancelada') {
    const reason = form.reason.trim()
    if (reason.length < 3 || reason.length > 500) {
      return false
    }
  }

  return true
}

const CRITICAL_ACTION_TEXT: Record<string, string> = {
  Cancelada: 'cancelar',
  Rejeitada: 'registrar a rejeição de',
  Denegada: 'registrar a denegação de',
  Inutilizada: 'inutilizar a numeração de',
}

// Retorna a pergunta de confirmação para eventos críticos, ou null quando não precisa confirmar.
export function fiscalStatusConfirmation(status: string, documentLabel: string): string | null {
  const action = CRITICAL_ACTION_TEXT[status]

  if (!action) {
    return null
  }

  return `Tem certeza de que deseja ${action} ${documentLabel}? Esta ação fica registrada no histórico fiscal e não pode ser desfeita.`
}

// ---------------------------------------------------------------------------
// Responsável (nome e e-mail) nos eventos.
// ---------------------------------------------------------------------------

export function fiscalActorLabel(person: {
  name?: string | null
  email?: string | null
  id?: string | null
}): { name: string; email: string } {
  if (person.name || person.email) {
    return { name: person.name || person.email || '', email: person.name ? person.email || '' : '' }
  }

  return {
    name: person.id ? `Usuário ${person.id.slice(0, 8)}` : 'Não registrado',
    email: '',
  }
}
