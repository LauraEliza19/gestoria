const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) =>
  fs.readFileSync(path.join(root, relative), 'utf8')

const types = read(
  'src/features/home/dashboardTypes.ts'
)
const service = read(
  'src/features/home/services/dashboardService.ts'
)
const hook = read(
  'src/features/home/useExecutiveDashboard.ts'
)
const screen = read(
  'src/features/home/screens/HomeScreen.tsx'
)

test('dashboard mobile matches the backend contract', () => {
  const fields = [
    'sales_today',
    'orders_in_preparation',
    'blocked_recipes',
    'critical_stock_items',
    'fiscal_attention',
    'active_employees',
    'open_employee_records',
    'financial_balance',
    'financial_available',
    'management_available',
  ]

  for (const field of fields) {
    assert.ok(types.includes(field), `missing field: ${field}`)
  }
})

test('dashboard uses the authenticated overview endpoint', () => {
  assert.match(service, /apiFetch<DashboardOverview>/)
  assert.match(service, /'\/api\/dashboard\/overview'/)
})

test('dashboard hook handles loading refresh and errors', () => {
  assert.match(hook, /getDashboardOverview\(\)/)
  assert.match(hook, /requestInFlight/)
  assert.match(hook, /setRefreshing\(true\)/)
  assert.match(hook, /setError\(getErrorMessage/)
  assert.match(hook, /setOverview\(response\)/)
})

test('executive home displays the main company indicators', () => {
  const labels = [
    'Vendas hoje',
    'Pedidos em andamento',
    'Produção bloqueada',
    'Estoque crítico',
    'Situação fiscal',
    'Saldo financeiro',
    'Precisa da sua atenção',
  ]

  for (const label of labels) {
    assert.ok(screen.includes(label), `missing label: ${label}`)
  }
})

test('executive home supports refresh retry and empty states', () => {
  assert.match(screen, /RefreshControl/)
  assert.match(screen, /refreshing=\{refreshing\}/)
  assert.match(screen, /onRefresh=\{refresh\}/)
  assert.match(screen, /Tentar novamente/)
  assert.match(screen, /Nenhuma pendência importante/)
  assert.match(screen, /overview\.alerts\.map/)
})

test('dashboard only navigates to available mobile routes', () => {
  assert.match(
    screen,
    /item\.action_route === '\/orders'/
  )
  assert.match(screen, /router\.push\('\/orders'\)/)
  assert.match(
    screen,
    /Este módulo será disponibilizado/
  )
})