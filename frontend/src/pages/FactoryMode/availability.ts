import type { Recipe, RecipeItem, Unit } from './productionTypes'

/*
 * Disponibilidade derivada do cálculo real feito pelo backend (/api/production).
 * O servidor continua sendo a fonte de max_batches, available_quantity e
 * missing_quantity; aqui só organizamos esses números para a operação:
 * receitas disponíveis x bloqueadas, ingrediente limitante, quanto falta para
 * mais uma receita e quais insumos cada pedido consome.
 *
 * Os valores chegam como decimais em texto (às vezes em notação científica,
 * ex.: "0E-3"), então toda a conta é feita em BigInt com 9 casas para evitar
 * erros de arredondamento de ponto flutuante.
 */

const SCALE = 9
const ONE = 10n ** BigInt(SCALE)
const BASE_FACTOR: Record<Unit, bigint> = { g: 1n, kg: 1000n, ml: 1n, L: 1000n, un: 1n }
const BASE_UNIT: Record<Unit, Unit> = { g: 'g', kg: 'g', ml: 'ml', L: 'ml', un: 'un' }
const COUNT_YIELDS = new Set([
  'un',
  'und',
  'unid',
  'unidade',
  'unidades',
  'pc',
  'pcs',
  'peca',
  'pecas',
  'porcao',
  'porcoes',
])

export type RecipeStatus = 'available' | 'blocked'

export type ItemAvailability = RecipeItem & {
  /** Quantas receitas este insumo sozinho permite preparar. */
  supported_batches: number
  /** Este insumo é o que limita a quantidade de receitas. */
  limiting: boolean
  /** Quanto falta deste insumo para preparar uma receita a mais (0 se já houver). */
  missing_for_next: string
}

export type RecipeAvailability = {
  recipe: Recipe
  status: RecipeStatus
  items: ItemAvailability[]
  missing_items: ItemAvailability[]
  limiting_items: ItemAvailability[]
  next_batch_shortfall: ItemAvailability[]
}

export type AvailabilitySummary = {
  available: RecipeAvailability[]
  blocked: RecipeAvailability[]
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

export function toScaled(value: string | number): bigint {
  const text = String(value).trim()
  const match = text.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/)
  if (!match || (match[2] === '' && !match[3])) return 0n
  const [, sign, whole, fraction = '', exponent = '0'] = match
  const digits = BigInt((whole || '0') + fraction)
  const shift = SCALE - fraction.length + Number(exponent)
  const scaled = shift >= 0 ? digits * 10n ** BigInt(shift) : digits / 10n ** BigInt(-shift)
  return sign === '-' ? -scaled : scaled
}

export function fromScaled(value: bigint): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const whole = absolute / ONE
  const fraction = (absolute % ONE).toString().padStart(SCALE, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole}${fraction ? '.' + fraction : ''}`
}

function positive(value: bigint): bigint {
  return value > 0n ? value : 0n
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator
}

function compareNames(a: string, b: string) {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

export function recipeAvailability(recipe: Recipe): RecipeAvailability {
  const status: RecipeStatus = recipe.max_batches > 0 ? 'available' : 'blocked'
  const next = BigInt(recipe.max_batches + 1)
  const items = recipe.items.map((item): ItemAvailability => {
    const quantity = toScaled(item.quantity)
    const available = positive(toScaled(item.available_quantity))
    const supported = quantity > 0n ? available / quantity : 0n
    return {
      ...item,
      supported_batches: Number(supported),
      limiting: false,
      missing_for_next: fromScaled(positive(quantity * next - available)),
    }
  })
  const lowest = items.length ? Math.min(...items.map((item) => item.supported_batches)) : 0
  for (const item of items) item.limiting = item.supported_batches === lowest
  return {
    recipe,
    status,
    items,
    missing_items: items.filter((item) => toScaled(item.missing_quantity) > 0n),
    limiting_items: items.filter((item) => item.limiting),
    next_batch_shortfall: items.filter((item) => toScaled(item.missing_for_next) > 0n),
  }
}

export function matchesQuery(entry: RecipeAvailability, query: string): boolean {
  const key = normalizeName(query)
  if (!key) return true
  return (
    normalizeName(entry.recipe.name).includes(key) ||
    entry.items.some((item) => normalizeName(item.ingredient_name).includes(key))
  )
}

export function buildAvailability(recipes: Recipe[], query = ''): AvailabilitySummary {
  const entries = recipes.map(recipeAvailability).filter((entry) => matchesQuery(entry, query))
  return {
    available: entries
      .filter((entry) => entry.status === 'available')
      .sort((a, b) => compareNames(a.recipe.name, b.recipe.name)),
    // As mais próximas de serem liberadas aparecem primeiro.
    blocked: entries
      .filter((entry) => entry.status === 'blocked')
      .sort(
        (a, b) =>
          a.missing_items.length - b.missing_items.length ||
          compareNames(a.recipe.name, b.recipe.name),
      ),
  }
}

/* ------------------------------------------------------------------ */
/* Integração com a fila de pedidos                                    */
/* ------------------------------------------------------------------ */

export type OrderLike = {
  id: string
  items: { product_name: string; quantity: string }[]
}

export type OrderLineSupply = {
  product_name: string
  quantity: string
  recipe: Recipe | null
  /** Receitas necessárias para atender a linha; null se o rendimento não é contável. */
  batches_needed: number | null
  /** A receita isoladamente cobre a linha; null quando não é possível calcular. */
  covered: boolean | null
}

export type OrderSupplyNeed = {
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  required: string
  available: string
  missing: string
}

export type OrderSupplyStatus = 'ready' | 'short' | 'partial' | 'unlinked'

export type OrderSupply = {
  lines: OrderLineSupply[]
  needs: OrderSupplyNeed[]
  status: OrderSupplyStatus
}

export function isCountYield(unit: string): boolean {
  return COUNT_YIELDS.has(normalizeName(unit).replace(/\.$/, ''))
}

export function recipeIndex(recipes: Recipe[]): Map<string, Recipe> {
  const index = new Map<string, Recipe>()
  for (const recipe of recipes) {
    const key = normalizeName(recipe.name)
    // Mesmo critério do backend: só nomes idênticos após normalização são ligados.
    if (!index.has(key)) index.set(key, recipe)
  }
  return index
}

export function orderSupplies(
  order: OrderLike,
  recipes: Recipe[] | Map<string, Recipe>,
): OrderSupply {
  const index = recipes instanceof Map ? recipes : recipeIndex(recipes)
  const needs = new Map<string, { name: string; unit: Unit; required: bigint; available: bigint }>()

  const lines = order.items.map((item): OrderLineSupply => {
    const recipe = index.get(normalizeName(item.product_name)) ?? null
    if (!recipe) {
      return {
        product_name: item.product_name,
        quantity: item.quantity,
        recipe,
        batches_needed: null,
        covered: null,
      }
    }
    if (!isCountYield(recipe.yield_unit)) {
      return {
        product_name: item.product_name,
        quantity: item.quantity,
        recipe,
        batches_needed: null,
        covered: recipe.max_batches > 0 ? null : false,
      }
    }
    const yieldQuantity = toScaled(recipe.yield_quantity)
    const ordered = positive(toScaled(item.quantity))
    const batches = yieldQuantity > 0n ? ceilDiv(ordered, yieldQuantity) : 0n
    for (const ingredient of recipe.items) {
      const factor = BASE_FACTOR[ingredient.unit]
      const current = needs.get(ingredient.ingredient_id) ?? {
        name: ingredient.ingredient_name,
        unit: BASE_UNIT[ingredient.unit],
        required: 0n,
        available: positive(toScaled(ingredient.available_quantity)) * factor,
      }
      current.required += batches * toScaled(ingredient.quantity) * factor
      needs.set(ingredient.ingredient_id, current)
    }
    return {
      product_name: item.product_name,
      quantity: item.quantity,
      recipe,
      batches_needed: Number(batches),
      covered: BigInt(recipe.max_batches) >= batches,
    }
  })

  const needList = [...needs.entries()]
    .map(([id, need]) => ({
      ingredient_id: id,
      ingredient_name: need.name,
      unit: need.unit,
      required: fromScaled(need.required),
      available: fromScaled(need.available),
      missing: fromScaled(positive(need.required - need.available)),
    }))
    .sort(
      (a, b) =>
        Number(toScaled(b.missing) > 0n) - Number(toScaled(a.missing) > 0n) ||
        compareNames(a.ingredient_name, b.ingredient_name),
    )

  const linked = lines.filter((line) => line.recipe)
  let status: OrderSupplyStatus
  if (linked.length === 0) status = 'unlinked'
  else if (
    linked.some((line) => line.covered === false) ||
    needList.some((need) => toScaled(need.missing) > 0n)
  )
    status = 'short'
  else if (linked.length < lines.length || linked.some((line) => line.covered === null))
    status = 'partial'
  else status = 'ready'

  return { lines, needs: needList, status }
}
