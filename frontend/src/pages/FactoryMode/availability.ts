import type { Recipe, Snapshot, Unit } from './productionTypes'

// Pure production math shared by the queue and the "O que posso preparar" board.
// Quantities are handled as thousandths of g, ml or un; stock values are exact integers.

type Dimension = 'mass' | 'volume' | 'count'
const factors: Record<Unit, [Dimension, number]> = {
  g: ['mass', 1],
  kg: ['mass', 1000],
  ml: ['volume', 1],
  L: ['volume', 1000],
  un: ['count', 1],
}
const baseUnits: Record<Dimension, Unit> = { mass: 'g', volume: 'ml', count: 'un' }
const countYields = new Set([
  'un',
  'und',
  'unid',
  'unidade',
  'unidades',
  'porcao',
  'porcoes',
  'peca',
  'pecas',
])
const massYields: Record<string, number> = {
  g: 1,
  grama: 1,
  gramas: 1,
  kg: 1000,
  quilo: 1000,
  quilos: 1000,
  quilograma: 1000,
  quilogramas: 1000,
}
const productMass: Record<string, number> = { g: 1, kg: 1000 }

export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

function toMilli(quantity: string | number, unit: Unit) {
  return Math.round(Number(quantity) * factors[unit][1] * 1000)
}

const fromMilli = (milli: number) => milli / 1000

export type QueueOrderItem = {
  product_name: string
  quantity: string
  recipe_id?: string | null
  unit_of_measure?: string | null
}
export type QueueOrder = {
  id: string
  status: string
  created_at: string
  items: QueueOrderItem[]
}
export type SupplyStatus = 'sufficient' | 'short' | 'partial' | 'unlinked'
export type SupplyLine = {
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  needed: number
  in_stock: number
  reserved_before: number
  available: number
  missing: number
}
export type ItemCoverage = {
  product_name: string
  quantity: string
  recipe_name?: string
  batches?: number
  reason?: string
}
export type OrderSupplies = {
  order_id: string
  position: number
  status: SupplyStatus
  lines: SupplyLine[]
  items: ItemCoverage[]
}

export const supplyLabels: Record<SupplyStatus, string> = {
  sufficient: 'Insumos suficientes',
  short: 'Faltam insumos',
  partial: 'Cobertura parcial',
  unlinked: 'Sem receita vinculada',
}

export function byQueueOrder(
  a: { created_at: string; id: string },
  b: { created_at: string; id: string },
) {
  const difference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  return difference || a.id.localeCompare(b.id)
}

export function batchesFor(
  item: QueueOrderItem,
  recipe: Recipe,
): { batches: number } | { reason: string } {
  const yieldUnit = normalizeText(recipe.yield_unit).replace(/\.$/, '')
  const productUnit = item.unit_of_measure ?? 'unit'
  const yieldQuantity = Number(recipe.yield_quantity)
  const quantity = Number(item.quantity)
  if (productUnit === 'unit') {
    if (countYields.has(yieldUnit)) return { batches: quantity / yieldQuantity }
    return {
      reason: `A receita rende ${recipe.yield_unit}. Para calcular, cadastre o rendimento em unidades, porções ou peças.`,
    }
  }
  const sold = productMass[productUnit]
  const produced = massYields[yieldUnit]
  if (sold && produced) return { batches: (quantity * sold) / (yieldQuantity * produced) }
  return {
    reason: `O produto é vendido em ${productUnit === 'kg' ? 'quilos' : 'gramas'} e a receita rende ${recipe.yield_unit}.`,
  }
}

/**
 * Plans the ingredients of every order in preparation following the queue:
 * older orders reserve first and later orders only see what is left. Nothing
 * is deducted from the real stock.
 */
export function planQueueSupplies(
  orders: QueueOrder[],
  snapshot: Snapshot,
): Map<string, OrderSupplies> {
  const recipes = new Map(snapshot.recipes.map((recipe) => [recipe.id, recipe]))
  const stock = new Map<string, number>()
  for (const item of snapshot.stock_items) {
    stock.set(
      item.ingredient_id,
      (stock.get(item.ingredient_id) ?? 0) + toMilli(item.quantity, item.unit),
    )
  }
  const reserved = new Map<string, number>()
  const plans = new Map<string, OrderSupplies>()
  const queue = orders.filter((order) => order.status === 'in_preparation').sort(byQueueOrder)

  queue.forEach((order, index) => {
    const needs = new Map<string, { name: string; unit: Unit; milli: number }>()
    let linked = 0
    let uncovered = 0
    const items = order.items.map((item): ItemCoverage => {
      const coverage = { product_name: item.product_name, quantity: item.quantity }
      if (!item.recipe_id) {
        uncovered += 1
        return { ...coverage, reason: 'Produto sem receita vinculada.' }
      }
      linked += 1
      const recipe = recipes.get(item.recipe_id)
      if (!recipe) {
        uncovered += 1
        return {
          ...coverage,
          reason: 'A receita vinculada não foi encontrada. Atualize os insumos.',
        }
      }
      const result = batchesFor(item, recipe)
      if ('reason' in result) {
        uncovered += 1
        return { ...coverage, recipe_name: recipe.name, reason: result.reason }
      }
      for (const ingredient of recipe.items) {
        const current = needs.get(ingredient.ingredient_id)
        // Fractional batches stay unrounded so three thirds of a recipe still fit one recipe.
        const milli = toMilli(ingredient.quantity, ingredient.unit) * result.batches
        needs.set(ingredient.ingredient_id, {
          name: ingredient.ingredient_name,
          unit: baseUnits[factors[ingredient.unit][0]],
          milli: (current?.milli ?? 0) + milli,
        })
      }
      return { ...coverage, recipe_name: recipe.name, batches: result.batches }
    })

    const lines = [...needs].map(([id, need]): SupplyLine => {
      const inStock = stock.get(id) ?? 0
      const before = reserved.get(id) ?? 0
      const available = Math.max(0, inStock - before)
      const shortfall = need.milli - available
      const short = shortfall > 1e-6 * Math.max(1, need.milli)
      reserved.set(id, before + Math.min(need.milli, available))
      return {
        ingredient_id: id,
        ingredient_name: need.name,
        unit: need.unit,
        needed: fromMilli(Math.round(need.milli)),
        in_stock: fromMilli(inStock),
        reserved_before: fromMilli(Math.round(before)),
        available: fromMilli(Math.round(available)),
        // A real shortage is never displayed as zero.
        missing: short ? fromMilli(Math.max(1, Math.round(shortfall))) : 0,
      }
    })
    lines.sort(
      (a, b) => b.missing - a.missing || a.ingredient_name.localeCompare(b.ingredient_name),
    )

    const status: SupplyStatus = lines.some((line) => line.missing > 0)
      ? 'short'
      : linked === 0
        ? 'unlinked'
        : uncovered > 0
          ? 'partial'
          : 'sufficient'
    plans.set(order.id, { order_id: order.id, position: index + 1, status, lines, items })
  })
  return plans
}

export type RecipeShortage = {
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  per_batch: number
  available: number
  missing: number
}
export type RecipeOutlook = {
  recipe: Recipe
  ready: boolean
  limiting: string[]
  next_batch: RecipeShortage[]
}
export type RecipeFilter = 'all' | 'ready' | 'blocked'

/** Each recipe is evaluated alone against the whole stock, as returned by the API. */
export function recipeOutlook(recipe: Recipe): RecipeOutlook {
  const target = recipe.max_batches + 1
  const rows = recipe.items.map((item) => {
    const perBatch = toMilli(item.quantity, item.unit)
    const available = toMilli(item.available_quantity, item.unit)
    return { item, perBatch, available, batches: Math.floor(available / perBatch) }
  })
  return {
    recipe,
    ready: recipe.max_batches > 0,
    limiting: rows
      .filter((row) => row.batches === recipe.max_batches)
      .map((row) => row.item.ingredient_name),
    next_batch: rows
      .filter((row) => row.perBatch * target > row.available)
      .map((row) => ({
        ingredient_id: row.item.ingredient_id,
        ingredient_name: row.item.ingredient_name,
        unit: baseUnits[factors[row.item.unit][0]],
        per_batch: fromMilli(row.perBatch),
        available: fromMilli(row.available),
        missing: fromMilli(row.perBatch * target - row.available),
      })),
  }
}

export function filterRecipes(recipes: Recipe[], query: string, filter: RecipeFilter) {
  const text = normalizeText(query)
  return recipes.filter(
    (recipe) =>
      (filter === 'all' || (filter === 'ready') === recipe.max_batches > 0) &&
      (!text ||
        normalizeText(recipe.name).includes(text) ||
        recipe.items.some((item) => normalizeText(item.ingredient_name).includes(text))),
  )
}
