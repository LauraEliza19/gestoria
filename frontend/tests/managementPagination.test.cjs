const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const source = fs.readFileSync(
  path.join(__dirname, '../src/services/management.service.ts'),
  'utf8',
)

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
})

function loadService() {
  const calls = []
  const employees = [{ id: 'employee-1', full_name: 'Funcionário Teste' }]
  const exports = {}

  const apiMock = {
    async apiFetch(path) {
      calls.push({ helper: 'apiFetch', path })
      return null
    },

    async apiFetchItems(path) {
      calls.push({ helper: 'apiFetchItems', path })
      return employees
    },
  }

  new Function('require', 'exports', outputText)((moduleName) => {
    if (moduleName === './api') return apiMock
    throw new Error(`Módulo inesperado: ${moduleName}`)
  }, exports)

  return { service: exports, calls, employees }
}

test('listEmployees extracts items from the paginated response', async () => {
  const { service, calls, employees } = loadService()

  const result = await service.listEmployees()

  assert.deepEqual(result, employees)
  assert.deepEqual(calls, [
    {
      helper: 'apiFetchItems',
      path: '/api/management/employees',
    },
  ])
})

test('listEmployees preserves the active employee filter', async () => {
  const { service, calls } = loadService()

  await service.listEmployees(true)

  assert.deepEqual(calls, [
    {
      helper: 'apiFetchItems',
      path: '/api/management/employees?active_only=true',
    },
  ])
})
