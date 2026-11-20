// Traduz os erros de validação do servidor (422) para mensagens em português,
// dizendo qual campo precisa de ajuste. Sem isso a tela mostrava, por exemplo,
// "String should have at most 2 characters".

export type ValidationIssue = {
  type?: string
  loc?: (string | number)[]
  msg?: string
  ctx?: Record<string, unknown>
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  full_name: 'Nome',
  trade_name: 'Nome fantasia',
  description: 'Descrição',
  document: 'CPF/CNPJ',
  state_registration: 'Inscrição estadual',
  municipal_registration: 'Inscrição municipal',
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  postal_code: 'CEP',
  street: 'Rua',
  number: 'Número',
  complement: 'Complemento',
  neighborhood: 'Bairro',
  city: 'Cidade',
  state: 'Estado (UF)',
  price: 'Preço',
  cost_price: 'Preço de custo',
  stock_quantity: 'Estoque',
  min_stock_quantity: 'Estoque mínimo',
  quantity: 'Quantidade',
  amount: 'Valor',
  ncm_code: 'NCM',
  cest_code: 'CEST',
  barcode: 'Código de barras',
  notes: 'Observações',
  valid_until: 'Validade',
  promised_at: 'Entrega',
  due_date: 'Vencimento',
  transaction_date: 'Data',
  birth_date: 'Data de nascimento',
  default_discount_percent: 'Desconto padrão',
  discount_percent: 'Desconto',
  general_discount_percent: 'Desconto geral',
  installment_count: 'Parcelas',
  shelf_life_days: 'Validade em dias',
}

function fieldLabel(issue: ValidationIssue): string {
  const path = (issue.loc ?? []).filter((part) => part !== 'body' && part !== 'query')
  const field = [...path].reverse().find((part) => typeof part === 'string')
  return typeof field === 'string' ? (FIELD_LABELS[field] ?? '') : ''
}

function withField(label: string, message: string): string {
  return label ? `${label}: ${message}` : message.charAt(0).toUpperCase() + message.slice(1)
}

export function translateValidationIssue(issue: ValidationIssue): string {
  const label = fieldLabel(issue)
  const ctx = issue.ctx ?? {}
  const original = (issue.msg ?? '').trim()

  if (/not a valid email address/i.test(original)) {
    return withField(label || 'E-mail', 'endereço inválido.')
  }

  switch (issue.type) {
    case 'value_error':
    case 'assertion_error':
      // Mensagens escritas pelo próprio sistema já vêm em português.
      return original.replace(/^(Value|Assertion) error,\s*/, '')
    case 'missing':
      return label ? `${label} é obrigatório.` : 'Preencha os campos obrigatórios.'
    case 'string_too_long':
      return withField(label, `use no máximo ${ctx.max_length} caracteres.`)
    case 'string_too_short':
      return Number(ctx.min_length) <= 1
        ? withField(label, 'preencha este campo.')
        : withField(label, `use pelo menos ${ctx.min_length} caracteres.`)
    case 'string_pattern_mismatch':
      return withField(label, 'formato inválido.')
    case 'greater_than':
      return withField(label, `informe um valor maior que ${ctx.gt}.`)
    case 'greater_than_equal':
      return withField(label, `informe um valor a partir de ${ctx.ge}.`)
    case 'less_than':
      return withField(label, `informe um valor menor que ${ctx.lt}.`)
    case 'less_than_equal':
      return withField(label, `informe um valor até ${ctx.le}.`)
    case 'decimal_max_places':
      return withField(label, `use no máximo ${ctx.decimal_places} casas decimais.`)
    case 'decimal_max_digits':
    case 'decimal_whole_digits':
      return withField(label, 'valor grande demais.')
    case 'decimal_parsing':
    case 'float_parsing':
    case 'int_parsing':
      return withField(label, 'informe um número válido.')
    case 'date_parsing':
    case 'date_from_datetime_parsing':
    case 'datetime_parsing':
    case 'datetime_from_date_parsing':
      return withField(label, 'informe uma data válida.')
    default:
      return label ? withField(label, 'confira o valor informado.') : original
  }
}

/** Primeira mensagem de um "detail" de erro 422 do servidor, já traduzida. */
export function validationMessage(detail: unknown): string | undefined {
  if (!Array.isArray(detail) || detail.length === 0) return undefined
  const first = detail[0] as ValidationIssue
  return first && typeof first === 'object' ? translateValidationIssue(first) : undefined
}
