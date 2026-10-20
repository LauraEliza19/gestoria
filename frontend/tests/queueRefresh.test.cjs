const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')
const source = readFileSync(join(__dirname, '../src/pages/FactoryMode/queueRefresh.ts'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText
const exported = {}
vm.runInNewContext(code, { exports: exported })
const { loadQueueAndSupplies } = exported

const describe = (reason, fallback) => (reason instanceof Error ? reason.message : fallback)

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

test('announces the update only after both the queue and the supplies finish', async () => {
  const orders = deferred()
  const supplies = deferred()
  let settled = false
  const pending = loadQueueAndSupplies(
    () => orders.promise,
    () => supplies.promise,
    describe,
  ).then((result) => {
    settled = true
    return result
  })

  orders.resolve(['pedido'])
  await new Promise((done) => setImmediate(done))
  assert.equal(settled, false)

  supplies.resolve({ recipes: [] })
  const result = await pending
  assert.equal(result.notice, 'Fila e insumos atualizados.')
  assert.equal(result.error, '')
  assert.equal(result.orders[0], 'pedido')
  assert.equal(result.supplies.recipes.length, 0)
})

test('starts both requests together', async () => {
  let suppliesStarted = false
  let parallel = false
  const result = await loadQueueAndSupplies(
    async () => {
      await new Promise((done) => setTimeout(done, 5))
      parallel = suppliesStarted
      return []
    },
    async () => {
      suppliesStarted = true
      return {}
    },
    describe,
  )
  assert.equal(parallel, true)
  assert.equal(result.notice, 'Fila e insumos atualizados.')
})

test('does not announce success when the supplies fail', async () => {
  const result = await loadQueueAndSupplies(
    async () => ['pedido'],
    async () => {
      throw new Error('Servidor indisponível.')
    },
    describe,
  )
  assert.equal(result.notice, '')
  assert.equal(result.orders.length, 1)
  assert.equal(result.supplies, undefined)
  assert.equal(
    result.error,
    'Fila atualizada, mas os insumos não foram carregados. Servidor indisponível.',
  )
})

test('does not announce success when the queue fails, even synchronously', async () => {
  const result = await loadQueueAndSupplies(
    () => {
      throw new Error('Sem conexão.')
    },
    async () => ({ recipes: [] }),
    describe,
  )
  assert.equal(result.notice, '')
  assert.equal(result.orders, undefined)
  assert.equal(result.error, 'Insumos atualizados, mas a fila não foi carregada. Sem conexão.')

  const both = await loadQueueAndSupplies(
    () => Promise.reject({ status: 503 }),
    async () => {
      throw new Error('Outra falha.')
    },
    describe,
  )
  assert.equal(both.notice, '')
  assert.equal(both.error, 'Não foi possível carregar a fila nem os insumos. Tente novamente.')
})
