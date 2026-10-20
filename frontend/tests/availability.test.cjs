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
const { planQueueSupplies, recipeOutlook, filterRecipes, batchesFor } = exported
const plain = (value) => JSON.parse(JSON.stringify(value))

const flour = { id: 'flour', name: 'Farinha de trigo', unit: 'g' }
const sugar = { id: 'sugar', name: 'Açúcar', unit: 'g' }

function stock(ingredient, quantity, unit = 'g') {
  return {
    id: `stock-${ingredient.id}-${quantity}`,
    name: `${ingredient.name} marca`,
    quantity,
    unit,
    ingredient_id: ingredient.id,
    ingredient_name: ingredient.name,
  }
}

function recipe(id, name, items, extra = {}) {
  return {
    id,
    name,
    yield_quantity: '30',
    yield_unit: 'unidades',
    max_batches: 0,
    possible_yield: '0',
    items: items.map(([ingredient, quantity, unit = 'g', available = '0']) => ({
      ingredient_id: ingredient.id,
      ingredient_name: ingredient.name,
      quantity,
      unit,
      available_quantity: available,
      missing_quantity: '0',
    })),
    ...extra,
  }
}

const bread = recipe('bread', 'Pão', [[flour, '500']])

function snapshot(stockItems, recipes = [bread]) {
  return { ingredients: [flour, sugar], stock_items: stockItems, recipes }
}

function order(id, createdAt, items, status = 'in_preparation') {
  return { id, status, created_at: createdAt, items }
}

function item(quantity, recipeId = 'bread', extra = {}) {
  return {
    product_name: 'Pão francês',
    quantity,
    recipe_id: recipeId,
    unit_of_measure: 'unit',
    ...extra,
  }
}

test('reserves supplies following the queue instead of checking each order alone', () => {
  const older = order('a', '2026-10-19T09:00:00Z', [item('30')])
  const newer = order('b', '2026-10-19T10:00:00Z', [item('45')])
  const data = snapshot([stock(flour, '1', 'kg')])

  assert.equal(planQueueSupplies([newer], data).get('b').status, 'sufficient')

  const plans = planQueueSupplies([newer, older], data)
  const first = plain(plans.get('a'))
  const second = plain(plans.get('b'))
  assert.equal(first.position, 1)
  assert.equal(first.status, 'sufficient')
  assert.deepEqual(
    [first.lines[0].needed, first.lines[0].available, first.lines[0].missing],
    [500, 1000, 0],
  )
  assert.equal(second.position, 2)
  assert.equal(second.status, 'short')
  assert.deepEqual(second.lines[0], {
    ingredient_id: 'flour',
    ingredient_name: 'Farinha de trigo',
    unit: 'g',
    needed: 750,
    in_stock: 1000,
    reserved_before: 500,
    available: 500,
    missing: 250,
  })
})

test('orders created at the same time follow their id and finished orders reserve nothing', () => {
  const data = snapshot([stock(flour, '600')])
  const plans = planQueueSupplies(
    [
      order('z', '2026-10-19T09:00:00Z', [item('30')]),
      order('done', '2026-10-19T08:00:00Z', [item('30')], 'completed'),
      order('gone', '2026-10-19T08:00:00Z', [item('30')], 'cancelled'),
      order('m', '2026-10-19T09:00:00Z', [item('30')]),
    ],
    data,
  )
  assert.equal(plans.has('done'), false)
  assert.equal(plans.has('gone'), false)
  assert.equal(plans.get('m').status, 'sufficient')
  assert.equal(plans.get('z').status, 'short')
  assert.equal(plans.get('z').lines[0].missing, 400)
})

test('an older order without enough stock keeps priority over newer orders', () => {
  const plans = planQueueSupplies(
    [
      order('a', '2026-10-19T09:00:00Z', [item('30')]),
      order('b', '2026-10-19T10:00:00Z', [item('15')]),
    ],
    snapshot([stock(flour, '400')]),
  )
  assert.equal(plans.get('a').status, 'short')
  assert.equal(plans.get('a').lines[0].missing, 100)
  assert.equal(plans.get('b').status, 'short')
  assert.equal(plans.get('b').lines[0].reserved_before, 400)
  assert.equal(plans.get('b').lines[0].missing, 250)
})

test('fractional batches add up exactly to the available stock', () => {
  const orders = ['a', 'b', 'c'].map((id, index) =>
    order(id, `2026-10-19T0${index + 1}:00:00Z`, [item('10')]),
  )
  const data = snapshot([stock(flour, '500')])
  const plans = planQueueSupplies(orders, data)
  assert.deepEqual(
    orders.map((entry) => plans.get(entry.id).status),
    ['sufficient', 'sufficient', 'sufficient'],
  )
  assert.equal(plans.get('a').lines[0].needed, 166.667)
  const extra = order('d', '2026-10-19T05:00:00Z', [item('1')])
  const withExtra = planQueueSupplies([...orders, extra], data).get('d')
  assert.equal(withExtra.status, 'short')
  assert.ok(withExtra.lines[0].missing > 0)
})

test('links order items to recipes by id, never by product or recipe name', () => {
  const renamed = recipe('bread', 'Broa caseira', [[flour, '500']])
  const sameName = recipe('other', 'Pão francês', [[sugar, '100']])
  const data = snapshot([stock(flour, '1', 'kg')], [renamed, sameName])
  const plans = planQueueSupplies(
    [
      order('linked', '2026-10-19T09:00:00Z', [item('30', 'bread')]),
      order('unlinked', '2026-10-19T10:00:00Z', [item('30', null)]),
      order('removed', '2026-10-19T11:00:00Z', [item('30', 'deleted-recipe')]),
    ],
    data,
  )
  const linked = plain(plans.get('linked'))
  assert.equal(linked.status, 'sufficient')
  assert.equal(linked.items[0].recipe_name, 'Broa caseira')
  assert.deepEqual(
    linked.lines.map((line) => line.ingredient_id),
    ['flour'],
  )
  assert.equal(plans.get('unlinked').status, 'unlinked')
  assert.equal(plans.get('unlinked').lines.length, 0)
  assert.equal(plans.get('unlinked').items[0].reason, 'Produto sem receita vinculada.')
  assert.equal(plans.get('removed').status, 'partial')
  assert.match(plans.get('removed').items[0].reason, /não foi encontrada/)
})

test('shows partial coverage when some items cannot be calculated', () => {
  const cake = recipe('cake', 'Bolo', [[sugar, '300']], {
    yield_quantity: '12',
    yield_unit: 'fatias',
  })
  const plans = planQueueSupplies(
    [
      order('mixed', '2026-10-19T09:00:00Z', [
        item('30'),
        item('1', 'cake', { product_name: 'Bolo inteiro' }),
        item('2', null, { product_name: 'Café' }),
      ]),
    ],
    snapshot([stock(flour, '1', 'kg')], [bread, cake]),
  )
  const plan = plain(plans.get('mixed'))
  assert.equal(plan.status, 'partial')
  assert.deepEqual(
    plan.lines.map((line) => line.ingredient_id),
    ['flour'],
  )
  assert.match(plan.items[1].reason, /fatias/)
  assert.equal(plan.items[2].reason, 'Produto sem receita vinculada.')
})

test('converts batches only between compatible sale and yield units', () => {
  const kilos = recipe('dough', 'Massa', [[flour, '1', 'kg']], {
    yield_quantity: '3',
    yield_unit: 'Kg',
  })
  assert.equal(batchesFor({ quantity: '1.5', unit_of_measure: 'kg' }, kilos).batches, 0.5)
  assert.equal(batchesFor({ quantity: '750', unit_of_measure: 'g' }, kilos).batches, 0.25)
  assert.match(batchesFor({ quantity: '2', unit_of_measure: 'unit' }, kilos).reason, /unidades/)
  assert.equal(batchesFor({ quantity: '15', unit_of_measure: 'unit' }, bread).batches, 0.5)
  const portions = recipe('soup', 'Sopa', [], { yield_quantity: '4', yield_unit: ' Porções ' })
  assert.equal(batchesFor({ quantity: '2' }, portions).batches, 0.5)
  assert.match(batchesFor({ quantity: '1', unit_of_measure: 'kg' }, bread).reason, /quilos/)
})

test('describes ready and blocked recipes with limiting and missing ingredients', () => {
  const eggs = { id: 'eggs', name: 'Ovos', unit: 'un' }
  const ready = recipeOutlook(
    recipe(
      'cake',
      'Bolo',
      [
        [flour, '0.5', 'kg', '1.2'],
        [eggs, '4', 'un', '10'],
        [sugar, '100', 'g', '1000'],
      ],
      { max_batches: 2 },
    ),
  )
  assert.equal(ready.ready, true)
  assert.deepEqual(plain(ready.limiting), ['Farinha de trigo', 'Ovos'])
  assert.deepEqual(plain(ready.next_batch), [
    {
      ingredient_id: 'flour',
      ingredient_name: 'Farinha de trigo',
      unit: 'g',
      per_batch: 500,
      available: 1200,
      missing: 300,
    },
    {
      ingredient_id: 'eggs',
      ingredient_name: 'Ovos',
      unit: 'un',
      per_batch: 4,
      available: 10,
      missing: 2,
    },
  ])

  const blocked = recipeOutlook(recipe('cheese', 'Pão de queijo', [[sugar, '300', 'g', '150']]))
  assert.equal(blocked.ready, false)
  assert.equal(blocked.next_batch.length, 1)
  assert.equal(blocked.next_batch[0].missing, 150)
})

test('filters recipes by recipe or ingredient name and by situation', () => {
  const recipes = [
    recipe('a', 'Pão', [[flour, '500']], { max_batches: 2 }),
    recipe('b', 'Brigadeiro', [[sugar, '100']]),
  ]
  const ids = (query, filter) => plain(filterRecipes(recipes, query, filter).map((r) => r.id))
  assert.deepEqual(ids('', 'all'), ['a', 'b'])
  assert.deepEqual(ids('  ACUCAR ', 'all'), ['b'])
  assert.deepEqual(ids('pao', 'all'), ['a'])
  assert.deepEqual(ids('', 'ready'), ['a'])
  assert.deepEqual(ids('', 'blocked'), ['b'])
  assert.deepEqual(ids('farinha', 'blocked'), [])
})
