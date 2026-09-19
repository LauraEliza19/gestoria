const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')

const source = readFileSync(join(__dirname, '../src/pages/FactoryMode/ingredientSuggestions.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText
const exported = {}
vm.runInNewContext(code, { exports: exported })
const { normalizeIngredientName, suggestIngredients } = exported
const ingredients = [
  { id: 'wheat', name: 'Farinha de trigo', unit: 'kg' },
  { id: 'rice', name: 'Farinha de arroz', unit: 'kg' },
  { id: 'sugar', name: 'Açúcar cristal', unit: 'g' },
  { id: 'milk', name: 'Leite', unit: 'L' },
]

test('case, accents and whitespace match the same name', () => {
  assert.equal(normalizeIngredientName('  AÇÚCAR   cristal '), 'acucar cristal')
  assert.equal(suggestIngredients('acucar CRISTAL', ingredients)[0].ingredient.id, 'sugar')
  assert.equal(suggestIngredients('acucar CRISTAL', ingredients)[0].exact, true)
})

test('misspellings and transposed letters suggest the intended ingredient', () => {
  for (const query of ['farina de trigo', 'farinha de trgio', 'frainha']) {
    assert.ok(suggestIngredients(query, ingredients).some(result => result.ingredient.id === 'wheat'), query)
  }
})

test('brand names suggest candidates without treating them as exact matches', () => {
  const results = suggestIngredients('Farinha Santa Amália', ingredients)
  assert.ok(results.some(result => result.ingredient.id === 'wheat'))
  assert.ok(results.some(result => result.ingredient.id === 'rice'))
  assert.ok(results.every(result => result.exact === false))
})

test('specific ingredient ranks ahead of similar alternatives', () => {
  assert.equal(suggestIngredients('farinha de arroz', ingredients)[0].ingredient.id, 'rice')
  assert.equal(suggestIngredients('farinha de trigo', ingredients)[0].ingredient.id, 'wheat')
})

test('unrelated names are not suggested and source data stays intact', () => {
  const before = JSON.stringify(ingredients)
  assert.equal(suggestIngredients('zzzzzz', ingredients).length, 0)
  suggestIngredients('farina', ingredients)
  assert.equal(JSON.stringify(ingredients), before)
  assert.ok(suggestIngredients('', ingredients).length > 0)
})
