const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/services/suppliers.service.ts'), 'utf8')

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
})

// Carrega o serviço com uma API simulada que devolve as páginas informadas.
function loadService(pages = []) {
  const calls = []
  const exports = {}

  const apiMock = {
    async apiFetch(requestPath, options) {
      calls.push({ path: requestPath, options })

      if (options) return { id: 'saved', ...JSON.parse(options.body) }

      const page = Number(new URL(requestPath, 'http://test').searchParams.get('page'))
      return typeof pages === 'function' ? pages(page) : (pages[page - 1] ?? { id: 'single' })
    },
  }

  new Function('require', 'exports', outputText)((moduleName) => {
    if (moduleName === './api') return apiMock
    throw new Error(`Módulo inesperado: ${moduleName}`)
  }, exports)

  return { service: exports, calls }
}

const supplier = (id) => ({ id, name: `Fornecedor ${id}`, document: '11222333000181' })

test('listAllSuppliers percorre todas as páginas até has_next ser falso', async () => {
  const { service, calls } = loadService([
    { items: [supplier('a'), supplier('b')], has_next: true },
    { items: [supplier('c')], has_next: true },
    { items: [supplier('d')], has_next: false },
  ])

  const result = await service.listAllSuppliers()

  assert.deepEqual(
    result.map((item) => item.id),
    ['a', 'b', 'c', 'd'],
  )
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      '/api/fiscal-suppliers?page=1&page_size=100&sort=name',
      '/api/fiscal-suppliers?page=2&page_size=100&sort=name',
      '/api/fiscal-suppliers?page=3&page_size=100&sort=name',
    ],
  )
})

test('listAllSuppliers faz uma única chamada quando cabe em uma página', async () => {
  const { service, calls } = loadService([{ items: [supplier('a')], has_next: false }])

  assert.deepEqual(await service.listAllSuppliers(), [supplier('a')])
  assert.equal(calls.length, 1)
})

test('listAllSuppliers devolve lista vazia sem fornecedores', async () => {
  const { service, calls } = loadService([{ items: [], has_next: false }])

  assert.deepEqual(await service.listAllSuppliers(), [])
  assert.equal(calls.length, 1)
})

test('listAllSuppliers respeita o limite de páginas aceito pela API', async () => {
  const { service, calls } = loadService([{ items: [], has_next: false }])

  await service.listAllSuppliers()

  // O backend recusa page_size acima de 100.
  assert.match(calls[0].path, /page_size=100(&|$)/)
})

test('listAllSuppliers para mesmo se a API nunca encerrar a paginação', async () => {
  const { service, calls } = loadService((page) => ({
    items: [supplier(String(page))],
    has_next: true,
  }))

  const result = await service.listAllSuppliers()

  assert.equal(calls.length, 100)
  assert.equal(result.length, 100)
})

test('listAllSuppliers repassa a falha da API', async () => {
  const { service } = loadService(() => {
    throw new Error('Falha ao carregar')
  })

  await assert.rejects(service.listAllSuppliers(), /Falha ao carregar/)
})

test('getSupplier consulta o fornecedor pelo identificador', async () => {
  const { service, calls } = loadService()

  await service.getSupplier('abc')

  assert.deepEqual(calls, [{ path: '/api/fiscal-suppliers/abc', options: undefined }])
})

test('createSupplier envia o cadastro por POST', async () => {
  const { service, calls } = loadService()
  const payload = {
    name: 'Moinho Central',
    document: '11222333000181',
    phone: '35999998888',
    email: null,
  }

  const saved = await service.createSupplier(payload)

  assert.equal(calls[0].path, '/api/fiscal-suppliers')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), payload)
  assert.equal(saved.id, 'saved')
})

test('updateSupplier envia somente os campos alterados por PATCH', async () => {
  const { service, calls } = loadService()

  await service.updateSupplier('abc', { is_active: false })

  assert.equal(calls[0].path, '/api/fiscal-suppliers/abc')
  assert.equal(calls[0].options.method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[0].options.body), { is_active: false })
})
