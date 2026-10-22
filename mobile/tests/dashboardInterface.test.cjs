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
const tokens = read('src/theme/tokens.ts')

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

test('executive home uses the GestorIA visual identity', () => {
  const labels = [
    'Sua empresa está sob controle.',
    'Hoje',
    'Vendas',
    'Em preparo',
    'Estoque crítico',
    'Em foco agora',
    'Prioridades',
  ]

  assert.match(tokens, /brandCyan:/)
  assert.match(tokens, /sheet:/)
  assert.doesNotMatch(screen, /gestoria-logo\.png/)
  assert.match(screen, /styles\.headerActions/)
  assert.match(screen, /minHeight:\s*32/)
  assert.match(screen, /sereneColors\.sheet/)
  assert.match(screen, /<StatusBar style="light" \/>/)

  for (const label of labels) {
    assert.ok(screen.includes(label), `missing label: ${label}`)
  }
})

test('executive home only displays real available indicators', () => {
  assert.match(screen, /overview\.summary\.sales_today/)
  assert.match(
    screen,
    /overview\.summary\s*\.orders_in_preparation/
  )
  assert.match(
    screen,
    /overview\.summary\s*\.critical_stock_items/
  )
  assert.doesNotMatch(screen, /value: 'Em breve'/)
  assert.doesNotMatch(screen, /Equilíbrio operacional/)
})

test('executive home supports refresh retry and empty states', () => {
  assert.match(screen, /RefreshControl/)
  assert.match(screen, /refreshing=\{refreshing\}/)
  assert.match(screen, /onRefresh=\{refresh\}/)
  assert.match(screen, /Tentar novamente/)
  assert.match(screen, /Tudo em ordem por aqui/)
  assert.match(screen, /priorityAlerts\.map/)
})

test('dashboard promotes the highest priority alert', () => {
  assert.match(screen, /overview\?\.alerts\[0\]/)
  assert.match(screen, /function FocusCard/)
  assert.match(screen, /item\.description/)
  assert.match(screen, /item\.impact/)
  assert.match(screen, /item\.action_label/)
})

test('dashboard priorities can expand their details', () => {
  assert.match(screen, /expandedAlertId/)
  assert.match(screen, /setExpandedAlertId/)
  assert.match(screen, /accessibilityState=\{\{ expanded \}\}/)
  assert.match(screen, /\{item\.impact\}/)
  assert.match(screen, /\{item\.action_label\}/)
})

test('dashboard only navigates to available mobile routes', () => {
  assert.match(
    screen,
    /item\.action_route === '\/orders'/
  )
  assert.match(screen, /router\.push\('\/orders'\)/)
  assert.match(
    screen,
    /A tela deste módulo será integrada/
  )
  assert.match(
    screen,
    /item\.action_route === '\/products'/
  )
  assert.match(
    screen,
    /router\.push\('\/products'\)/
  )
})
