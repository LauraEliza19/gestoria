export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'un'
export type Ingredient = { id: string; name: string; unit: Unit }
export type StockItem = { id: string; name: string; quantity: string; unit: Unit; ingredient_id: string; ingredient_name: string }
export type RecipeItem = { ingredient_id: string; ingredient_name: string; quantity: string; unit: Unit; available_quantity: string; missing_quantity: string }
export type Recipe = { id: string; name: string; yield_quantity: string; yield_unit: string; items: RecipeItem[]; max_batches: number; possible_yield: string }
export type Snapshot = { ingredients: Ingredient[]; stock_items: StockItem[]; recipes: Recipe[] }
export type IngredientChoice = { name: string; id?: string; confirmed: boolean }
export type IngredientReference = { ingredient_id: string } | { ingredient_name: string }
export type RecipeDraft = { name: string; yield_quantity: string; yield_unit: string; items: (IngredientReference & { quantity: string; unit: Unit })[] }
export type StockDraft = IngredientReference & { name: string; quantity: string; unit: Unit }

export const units: Unit[] = ['g', 'kg', 'ml', 'L', 'un']
export const formatQuantity = (value: string | number) => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 6 })
export const compatible = (unit: Unit): Unit[] => unit === 'g' || unit === 'kg' ? ['g', 'kg'] : unit === 'ml' || unit === 'L' ? ['ml', 'L'] : ['un']
export const reference = (choice: IngredientChoice): IngredientReference => choice.id ? { ingredient_id: choice.id } : { ingredient_name: choice.name.trim() }
