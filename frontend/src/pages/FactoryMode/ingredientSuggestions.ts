import type { Ingredient } from './productionTypes'

export function normalizeIngredientName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function similarity(a: string, b: string) {
  if (a === b) return 1
  if (!a || !b) return 0
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  let beforePrevious = previous
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        current[j] = Math.min(current[j], beforePrevious[j - 2] + 1)
      }
    }
    beforePrevious = previous
    previous = current
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length)
}

export function suggestIngredients(query: string, ingredients: Ingredient[]) {
  const normalized = normalizeIngredientName(query).slice(0, 120)
  const tokens = (value: string) => value.split(/[^a-z0-9]+/).filter(token => token.length >= 3)
  return ingredients.map(ingredient => {
    const name = normalizeIngredientName(ingredient.name)
    let score = normalized ? similarity(normalized, name) : 0.6
    if (normalized && (name.includes(normalized) || normalized.includes(name))) score = Math.max(score, 0.9)
    // Shared ingredient words surface branded items; similarity only ranks
    // suggestions. It never determines an association.
    for (const queryToken of tokens(normalized)) {
      for (const nameToken of tokens(name)) {
        const tokenScore = similarity(queryToken, nameToken)
        if (tokenScore >= 0.75) score = Math.max(score, tokenScore * 0.8)
      }
    }
    return { ingredient, score, exact: normalized === name }
  }).filter(result => result.score >= 0.55)
    .sort((a, b) => b.score - a.score || a.ingredient.name.localeCompare(b.ingredient.name, 'pt-BR'))
    .slice(0, 6)
}
