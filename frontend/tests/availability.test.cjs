const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')
const source = readFileSync(join(__dirname, '../src/pages/FactoryMode/availability.ts'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText
const exported = {}
vm.runInNewContext(code, { exports: exported })
const { toScaled, fromScaled, recipeAvailability, buildAvailability, orderSupplies, isCountYield } =
  exported
const plain = (value) => JSON.parse(JSON.stringify(value))

function item(name, quantity, unit, available, missing = '0') {
  return {
    ingredient_id: `id-${name}`,
    ingredient_name: name,
    quantity,
    unit,
    available_quantity: available,
    missing_quantity: missing,
  }
}

function recipe(name, maxBatches, items, yieldQuantity = '30', yieldUnit = 'unidades') {
  return {
    id: `r-${name}`,
    name,
    yield_quantity: yieldQuantity,
    yield_unit: yieldUnit,
    items,
    max_batches: maxBatches,
    possible_yield: String(Number(yieldQuantity) * maxBatches),
  }
}

const pao = recipe('Pão', 2, [
  item('Farinha de trigo', '1', 'kg', '2.5'),
  item('Leite', '240', 'ml', '3000'),
  item('Queijo', '300', 'g', '600'),
])
const bolo = recipe('Bolo', 0, [
  item('Farinha de trigo', '500', 'g', '2500'),
  item('Ovos', '4', 'un', '0', '4'),
  item('Açúcar', '200', 'g', '150', '50'),
])
const torta = recipe('Torta', 0, [item('Queijo', '1', 'kg', '0.6', '0.4')], '8', 'fatias')

test('parses backend decimals, including scientific notation, without float errors', () => {
  assert.equal(fromScaled(toScaled('0E-3')), '0')
  assert.equal(fromScaled(toScaled('1500.000')), '1500')
  assert.equal(fromScaled(toScaled('0.000001')), '0.000001')
  assert.equal(fromScaled(toScaled('2.5E+3')), '2500')
  assert.equal(fromScaled(toScaled('0.1') + toScaled('0.2')), '0.3')
  assert.equal(fromScaled(toScaled(3)), '3')
})

test('identifies the limiting ingredient and what is missing for one more batch', () => {
  const result = plain(recipeAvailability(pao))
  assert.equal(result.status, 'available')
  assert.deepEqual(
    result.items.map((row) => [row.ingredient_name, row.supported_batches, row.limiting]),
    [
      ['Farinha de trigo', 2, true],
      ['Leite', 12, false],
      ['Queijo', 2, true],
    ],
  )
  assert.deepEqual(
    result.next_batch_shortfall.map((row) => [row.ingredient_name, row.missing_for_next]),
    [
      ['Farinha de trigo', '0.5'],
      ['Queijo', '300'],
    ],
  )
})

test('blocked recipes list exactly the inputs that are missing', () => {
  const result = plain(recipeAvailability(bolo))
  assert.equal(result.status, 'blocked')
  assert.deepEqual(
    result.missing_items.map((row) => [row.ingredient_name, row.missing_quantity]),
    [
      ['Ovos', '4'],
      ['Açúcar', '50'],
    ],
  )
  assert.deepEqual(
    result.next_batch_shortfall.map((row) => row.missing_for_next),
    ['4', '50'],
  )
})

test('splits available and blocked recipes, blocked closest to unblocking first', () => {
  const summary = plain(buildAvailability([bolo, pao, torta]))
  assert.deepEqual(
    summary.available.map((entry) => entry.recipe.name),
    ['Pão'],
  )
  assert.deepEqual(
    summary.blocked.map((entry) => entry.recipe.name),
    ['Torta', 'Bolo'],
  )
})

test('search matches recipe names and ingredient names ignoring accents', () => {
  const byIngredient = plain(buildAvailability([bolo, pao, torta], 'acucar'))
  assert.deepEqual(
    byIngredient.blocked.map((entry) => entry.recipe.name),
    ['Bolo'],
  )
  assert.equal(byIngredient.available.length, 0)
  const byRecipe = plain(buildAvailability([bolo, pao, torta], '  PÃO '))
  assert.deepEqual(
    byRecipe.available.map((entry) => entry.recipe.name),
    ['Pão'],
  )
  assert.equal(plain(buildAvailability([pao], 'inexistente')).available.length, 0)
})

test('recognizes countable yield units', () => {
  for (const unit of ['unidades', 'Unidade', 'un', 'un.', 'Porções', 'peças']) {
    assert.ok(isCountYield(unit), unit)
  }
  for (const unit of ['kg', 'litros', 'fatias de 2kg']) {
    assert.ok(!isCountYield(unit), unit)
  }
})

test('order supplies: batches needed, aggregated inputs and shortage', () => {
  const order = {
    id: 'o1',
    items: [
      { product_name: 'pao', quantity: '45' },
      { product_name: 'BOLO', quantity: '10' },
    ],
  }
  const result = plain(orderSupplies(order, [pao, bolo, torta]))
  assert.equal(result.status, 'short')
  assert.deepEqual(
    result.lines.map((line) => [line.recipe.name, line.batches_needed, line.covered]),
    [
      ['Pão', 2, true],
      ['Bolo', 1, false],
    ],
  )
  const flour = result.needs.find((need) => need.ingredient_name === 'Farinha de trigo')
  // 2 receitas de pão (2 kg) + 1 bolo (500 g) = 2500 g; estoque = 2500 g
  assert.deepEqual(
    [flour.unit, flour.required, flour.available, flour.missing],
    ['g', '2500', '2500', '0'],
  )
  assert.equal(result.needs[0].ingredient_name, 'Açúcar')
  assert.equal(result.needs[0].missing, '50')
})

test('shared ingredients across lines can block an order even when each recipe alone fits', () => {
  const doce = recipe('Doce', 1, [item('Açúcar', '200', 'g', '300')], '10', 'unidades')
  const calda = recipe('Calda', 1, [item('Açúcar', '200', 'g', '300')], '10', 'unidades')
  const result = plain(
    orderSupplies(
      {
        id: 'o2',
        items: [
          { product_name: 'Doce', quantity: '10' },
          { product_name: 'Calda', quantity: '5' },
        ],
      },
      [doce, calda],
    ),
  )
  assert.deepEqual(
    result.lines.map((line) => line.covered),
    [true, true],
  )
  assert.equal(result.status, 'short')
  assert.equal(result.needs[0].missing, '100')
})

test('order supply statuses for ready, partial and unlinked orders', () => {
  assert.equal(
    orderSupplies({ id: 'a', items: [{ product_name: 'Pão', quantity: '30' }] }, [pao]).status,
    'ready',
  )
  assert.equal(
    orderSupplies(
      {
        id: 'b',
        items: [
          { product_name: 'Pão', quantity: '30' },
          { product_name: 'Refrigerante', quantity: '2' },
        ],
      },
      [pao],
    ).status,
    'partial',
  )
  assert.equal(
    orderSupplies({ id: 'c', items: [{ product_name: 'Água', quantity: '1' }] }, [pao]).status,
    'unlinked',
  )
  const fatias = plain(
    orderSupplies({ id: 'd', items: [{ product_name: 'Torta', quantity: '1' }] }, [torta]),
  )
  assert.equal(fatias.status, 'short')
  assert.equal(fatias.lines[0].batches_needed, null)
})
