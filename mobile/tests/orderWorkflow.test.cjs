const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const types = read('src/features/orders/orderTypes.ts')
const screen = read('src/features/orders/screens/OrdersScreen.tsx')

test('mobile orders support every delivery workflow status', () => {
  for (const status of ['in_preparation', 'in_production', 'ready', 'completed', 'cancelled']) {
    assert.ok(types.includes(`'${status}'`), `missing status: ${status}`)
  }
})

test('mobile orders show delivery planning fields', () => {
  for (const field of ['promised_at', 'priority', 'notes']) {
    assert.ok(types.includes(field), `missing field: ${field}`)
  }
  assert.match(screen, /Entrega /)
  assert.match(screen, /Prioridade/)
})
