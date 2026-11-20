// Formatação compartilhada pelas telas: datas locais, quantidades, telefones e pedidos.

const quantityFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

/** Quantidade sem zeros inúteis: "3.000" vira "3" e "1.500" vira "1,5". */
export function formatQuantity(value: string | number | null | undefined): string {
  const number = Number(value)
  return Number.isFinite(number) ? quantityFormatter.format(number) : String(value ?? '')
}

/** Data de hoje (AAAA-MM-DD) no fuso do navegador, e não em UTC. */
export function localDateInputValue(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Data local daqui a alguns dias, no formato do campo de data. */
export function localDateAfterDays(days: number, from: Date = new Date()): string {
  const date = new Date(from)
  date.setDate(date.getDate() + days)
  return localDateInputValue(date)
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** Telefone para leitura: (35) 3714-2200 ou (35) 99999-8888. */
export function formatPhone(value: string | null | undefined): string {
  const digits = onlyDigits(value)
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  return value ?? ''
}

/** Máscara de telefone enquanto a pessoa digita. */
export function maskPhoneInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits
  const area = digits.slice(0, 2)
  const rest = digits.slice(2)
  const split = rest.length > 8 ? 5 : 4
  const first = rest.slice(0, split)
  const last = rest.slice(split)
  return last ? `(${area}) ${first}-${last}` : `(${area}) ${first}`
}

/** Máscara de CEP enquanto a pessoa digita: 37701-000. */
export function maskPostalCode(value: string): string {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

/** Número do pedido para exibição; pedidos antigos sem número usam o início do id. */
export function orderLabel(order: { id: string; code?: string | null }): string {
  return order.code || `#${order.id.slice(0, 8).toUpperCase()}`
}

/** "1 unidade", "2 unidades", "1 kg": evita repetir ou errar o plural da unidade. */
export function formatYield(quantity: string | number, unit: string): string {
  const amount = formatQuantity(quantity)
  const cleanUnit = unit.trim()
  const singular: Record<string, string> = { unidades: 'unidade', fatias: 'fatia' }
  const plural: Record<string, string> = { unidade: 'unidades', fatia: 'fatias' }
  const lower = cleanUnit.toLowerCase()
  if (Number(quantity) === 1 && singular[lower]) return `${amount} ${singular[lower]}`
  if (Number(quantity) !== 1 && plural[lower]) return `${amount} ${plural[lower]}`
  return `${amount} ${cleanUnit}`.trim()
}

/** Valor para campo datetime-local: amanhã ao meio-dia, no fuso do navegador. */
export function defaultDeliveryInputValue(from: Date = new Date()): string {
  const date = new Date(from)
  date.setDate(date.getDate() + 1)
  date.setHours(12, 0, 0, 0)
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${localDateInputValue(date)}T${time}`
}
