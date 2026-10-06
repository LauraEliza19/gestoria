import type { Unit } from './productionTypes'

const units: Record<string, { family: string; factor: bigint }> = {}
for (const [names, family, factor] of [
  [['g', 'grama', 'gramas'], 'mass', 1n],
  [['kg', 'quilo', 'quilos', 'quilograma', 'quilogramas'], 'mass', 1000n],
  [['ml', 'mililitro', 'mililitros'], 'volume', 1n],
  [['l', 'litro', 'litros'], 'volume', 1000n],
  [['un', 'unidade', 'unidades'], 'count', 1n],
] as const) {
  for (const name of names) units[name] = { family, factor }
}

export function defaultUsageUnit(unit: Unit): Unit {
  return unit === 'kg' ? 'g' : unit === 'L' ? 'ml' : unit
}

export function friendlyAmount(quantity: string | number, unit: Unit): string {
  const base = Number(quantity) * (unit === 'kg' || unit === 'L' ? 1000 : 1)
  const mass = unit === 'g' || unit === 'kg'
  const volume = unit === 'ml' || unit === 'L'
  const large = (mass || volume) && base >= 1000
  const value = large ? base / 1000 : base
  const label = mass
    ? large
      ? 'kg'
      : 'g'
    : volume
      ? large
        ? 'L'
        : 'ml'
      : value === 1
        ? 'unidade'
        : 'unidades'
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} ${label}`
}

type UsageResult =
  | { quantity: string; milli: number; error?: never }
  | { error: string; quantity?: never; milli?: never }

export function parseUsage(input: string, stockUnit: Unit, stockQuantity: string): UsageResult {
  let text = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(usei|utilizei|gastei)\s+/, '')
    .replace(/\s+/g, ' ')
  const target = units[stockUnit.toLowerCase()]
  const available = BigInt(Math.round(Number(stockQuantity) * 1000))
  let milli: bigint
  if (['tudo', 'todo o saldo', 'todo', 'toda'].includes(text)) {
    milli = available
  } else if (['metade', 'a metade'].includes(text)) {
    if (available % 2n !== 0n)
      return {
        error: 'A metade não é uma medida exata neste cadastro. Informe a quantidade que usou.',
      }
    milli = available / 2n
  } else {
    text = text.replace(/^(meio|meia)\s+/, '0,5 ').replace(/^(um|uma)\s+/, '1 ')
    const match = text.match(/^([0-9]+(?:[.,][0-9]+)*)\s*([a-z]+)?$/)
    if (!match)
      return { error: 'Não entendi a quantidade. Tente “800 g”, “250 ml” ou “2 unidades”.' }
    const source = units[match[2] ?? defaultUsageUnit(stockUnit).toLowerCase()]
    if (!source || source.family !== target.family)
      return {
        error: `Use ${target.family === 'mass' ? 'gramas ou quilos' : target.family === 'volume' ? 'ml ou litros' : 'unidades'} para este item.`,
      }
    let number = match[1]
    if (/^[1-9][0-9]{0,2}(?:\.[0-9]{3})+(?:,[0-9]+)?$/.test(number))
      number = number.replace(/\./g, '')
    if (!/^[0-9]+(?:[.,][0-9]+)?$/.test(number) || number.length > 18)
      return { error: 'Confira o número informado. Exemplo: 800 g ou 1,5 kg.' }
    const [whole, fraction = ''] = number.replace(',', '.').split('.')
    const numerator = BigInt(whole + fraction) * source.factor * 1000n
    const denominator = 10n ** BigInt(fraction.length) * target.factor
    if (numerator % denominator !== 0n)
      return {
        error: `Neste cadastro, informe múltiplos de ${friendlyAmount('0.001', stockUnit)}.`,
      }
    milli = numerator / denominator
  }
  if (milli <= 0n) return { error: 'Informe uma quantidade maior que zero.' }
  if (milli > available)
    return {
      error: `Você tem ${friendlyAmount(stockQuantity, stockUnit)}. Escolha uma quantidade menor ou confira o estoque.`,
    }
  return {
    quantity: `${milli / 1000n}.${(milli % 1000n).toString().padStart(3, '0')}`,
    milli: Number(milli),
  }
}

export function usageSuggestions(unit: Unit): string[] {
  return unit === 'g' || unit === 'kg'
    ? ['100 g', '250 g', '500 g', '1 kg']
    : unit === 'ml' || unit === 'L'
      ? ['100 ml', '250 ml', '500 ml', '1 L']
      : ['1 unidade', '2 unidades', '5 unidades', '10 unidades']
}
