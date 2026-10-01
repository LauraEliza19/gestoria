const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

function load(fetch) {
  const redirects = []
  const removed = []
  const modules = {}
  const context = {
    fetch,
    Headers,
    Error,
    navigator: { locks: { request: (_name, work) => work() } },
    window: { location: { replace: (value) => redirects.push(value) } },
    localStorage: { removeItem: (key) => removed.push(key) },
    sessionStorage: { removeItem: (key) => removed.push(key) },
  }
  for (const file of ['session', 'api', 'auth.service']) {
    const code = ts.transpileModule(
      readFileSync(join(__dirname, `../src/services/${file}.ts`), 'utf8'),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
      },
    ).outputText
    const exports = {}
    vm.runInNewContext(code, { ...context, exports, require: (name) => modules[name] })
    modules[`./${file}`] = exports
  }
  return {
    ...modules['./session'],
    ...modules['./api'],
    ...modules['./auth.service'],
    redirects,
    removed,
  }
}

const json = (status, body = {}) => new Response(JSON.stringify(body), { status })

test('parallel expired requests share one renewal and retry with cookies', async () => {
  let valid = false
  let refreshes = 0
  const calls = []
  const api = load(async (path, options) => {
    calls.push([path, options])
    if (path === '/api/auth/refresh') {
      refreshes++
      await new Promise((resolve) => setImmediate(resolve))
      valid = true
      return json(200)
    }
    return json(valid ? 200 : 401, { value: 42 })
  })
  const values = await Promise.all([api.apiFetch('/api/products'), api.apiFetch('/api/products')])
  assert.equal(refreshes, 1)
  assert.equal(values[0].value, 42)
  assert.equal(values[1].value, 42)
  assert.equal(api.redirects.length, 0)
  for (const [path, options] of calls) {
    assert.equal(options.credentials, 'same-origin')
    if (path === '/api/products') {
      assert.equal(options.headers.get('X-CSRF-Protection'), '1')
      assert.equal(options.headers.has('Authorization'), false)
    }
  }
})

test('expired absolute session redirects after failed renewal without endless retries', async () => {
  let requests = 0
  const api = load(async () => {
    requests++
    return json(401)
  })
  await assert.rejects(api.apiFetch('/api/products'), /expirou/)
  assert.equal(requests, 3)
  assert.deepEqual(api.redirects, ['/login'])
})

test('temporary refresh failure preserves session and does not redirect', async () => {
  const api = load(async (path) => json(path === '/api/auth/refresh' ? 503 : 401))
  await assert.rejects(api.apiFetch('/api/products'), /renovar/)
  assert.equal(api.redirects.length, 0)
})

test('logout waits for server confirmation and reports a failed revocation', async () => {
  let success = false
  const api = load(async (path, options) => {
    assert.equal(path, '/api/auth/logout')
    assert.equal(options.method, 'POST')
    return success ? new Response(null, { status: 204 }) : json(503)
  })
  await assert.rejects(api.logoutSession(), /encerrar/)
  assert.equal(api.redirects.length, 0)
  success = true
  await api.logoutSession()
  assert.deepEqual(api.redirects, ['/login'])
  assert.equal(api.removed.length, 2)
})

test('login sends remember choice and CSRF header without storing a token', async () => {
  const api = load(async (path, options) => {
    assert.equal(path, '/api/auth/login')
    assert.equal(options.headers['X-CSRF-Protection'], '1')
    assert.equal(JSON.parse(options.body).remember, true)
    return json(200, { expires_at: '2026-11-01T12:00:00Z' })
  })
  await api.login('someone@example.com', 'password-input', true)
  assert.equal(api.removed.length, 0)
})
