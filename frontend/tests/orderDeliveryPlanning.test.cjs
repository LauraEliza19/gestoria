const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const form = read('src/pages/Orders/OrderFormPage.tsx')
const list = read('src/pages/Orders/OrdersPage.tsx')
const factory = read('src/pages/FactoryMode/FactoryModePage.tsx')

test('order form collects delivery planning before creating the protected proposal', () => {
  assert.match(form, /type="datetime-local"/)
  assert.match(form, /promised_at: new Date\(promisedAt\)\.toISOString\(\)/)
  assert.match(form, /priority/)
  assert.match(form, /notes/)
})

test('order list exposes the complete operational workflow', () => {
  for (const status of ['in_preparation', 'in_production', 'ready', 'completed', 'cancelled']) {
    assert.ok(list.includes(status), `missing status: ${status}`)
  }
  assert.match(list, /Atrasado/)
  assert.match(list, /promised_at/)
})

test('production queue advances orders one operational step at a time', () => {
  assert.match(factory, /'in_preparation'\s*\?\s*'in_production'/)
  assert.match(factory, /'in_production'\s*\?\s*'ready'/)
  assert.match(factory, /'Marcar como entregue'/)
  assert.match(factory, /Entrega combinada/)
})
