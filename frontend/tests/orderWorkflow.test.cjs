const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(
  path.join(__dirname, '../src/pages/FactoryMode/orderWorkflow.ts'),
  'utf8',
)

const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2023,
  },
}).outputText

const exported = {}

vm.runInNewContext(code, {
  exports: exported,
})

const { isOperationalOrderStatus, nextOperationalStatus, operationalActionLabel } = exported

test('recognizes only statuses that can advance in production', () => {
  assert.equal(isOperationalOrderStatus('in_preparation'), true)
  assert.equal(isOperationalOrderStatus('in_production'), true)
  assert.equal(isOperationalOrderStatus('ready'), true)
  assert.equal(isOperationalOrderStatus('completed'), false)
  assert.equal(isOperationalOrderStatus('cancelled'), false)
})

test('advances orders through the operational workflow', () => {
  assert.equal(nextOperationalStatus('in_preparation'), 'in_production')
  assert.equal(nextOperationalStatus('in_production'), 'ready')
  assert.equal(nextOperationalStatus('ready'), 'completed')
  assert.equal(nextOperationalStatus('completed'), null)
  assert.equal(nextOperationalStatus('cancelled'), null)
})

test('provides the action shown to the operator', () => {
  assert.equal(operationalActionLabel('in_preparation'), 'Iniciar produção')
  assert.equal(operationalActionLabel('in_production'), 'Marcar como pronto')
  assert.equal(operationalActionLabel('ready'), 'Marcar como entregue')
  assert.equal(operationalActionLabel('completed'), null)
  assert.equal(operationalActionLabel('cancelled'), null)
})
