const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) =>
  fs.readFileSync(path.join(root, relative), 'utf8')

const types = read('src/features/finance/financeTypes.ts')
const service = read(
  'src/features/finance/services/financeService.ts'
)
const hook = read('src/features/finance/useFinance.ts')
const screen = read(
  'src/features/finance/screens/FinanceScreen.tsx'
)
const entryScreen = read(
  'src/features/finance/screens/FinanceEntryScreen.tsx'
)
const modules = read(
  'src/features/modules/screens/ModulesScreen.tsx'
)
const layout = read('src/app/(app)/_layout.tsx')

test('finance mobile matches the backend contract', () => {
  const fields = [
    'total_income',
    'total_expense',
    'balance',
    'category_id',
    'entry_type',
    'transaction_date',
    'paid_at',
  ]

  for (const field of fields) {
    assert.ok(types.includes(field), `missing field: ${field}`)
  }
})

test('finance service uses authenticated API endpoints', () => {
  assert.match(service, /'\/api\/finance\/categories'/)
  assert.match(service, /`\/api\/finance\/entries\$\{buildQuery/)
  assert.match(service, /`\/api\/finance\/summary\$\{buildQuery/)
  assert.match(service, /Promise\.all/)
  assert.match(service, /createFinanceEntry/)
  assert.match(service, /createFinanceCategory/)
  assert.match(service, /method: 'POST'/)
})

test('finance mobile can create a protected entry', () => {
  const labels = [
    'Novo lançamento',
    'Dados do lançamento',
    'Nova categoria',
    'Revisar lançamento',
    'Lançamento registrado',
  ]

  for (const label of labels) {
    assert.ok(
      entryScreen.includes(label),
      `missing entry label: ${label}`,
    )
  }

  assert.match(screen, /router\.push\('\/finance-entry'\)/)
  assert.match(screen, /session\?\.role === 'owner'/)
  assert.match(entryScreen, /createFinanceEntry\(payload\)/)
  assert.match(entryScreen, /createFinanceCategory/)
  assert.match(entryScreen, /parseDate/)
  assert.match(entryScreen, /parseAmount/)
  assert.match(entryScreen, /Somente proprietários e administradores/)
  assert.match(entryScreen, /router\.replace\('\/finance'\)/)
})

test('finance hook supports filters refresh retry and errors', () => {
  assert.match(hook, /getFinanceData\(filters\)/)
  assert.match(hook, /selectType/)
  assert.match(hook, /selectStatus/)
  assert.match(hook, /setRefreshing\(true\)/)
  assert.match(hook, /setError\(getErrorMessage/)
})

test('finance screen presents real summary and entries', () => {
  const labels = [
    'Financeiro',
    'Saldo realizado',
    'Entradas',
    'Saídas',
    'Fluxo recente',
    'Situação',
  ]

  for (const label of labels) {
    assert.ok(screen.includes(label), `missing label: ${label}`)
  }

  assert.match(screen, /data\.summary\.balance/)
  assert.match(screen, /styles\.balanceOverview/)
  assert.match(screen, /styles\.filterPillSelected/)
  assert.match(screen, /statusPickerVisible/)
  assert.match(screen, /<Modal/)
  assert.match(screen, /handleStatusSelect/)
  assert.match(screen, /styles\.statusSelector/)
  assert.match(screen, /data\.entries\.map/)
  assert.match(screen, /RefreshControl/)
  assert.match(screen, /Nenhum lançamento encontrado/)
})

test('finance is reachable from modules without adding a tab', () => {
  assert.match(modules, /type AvailableRoute = '\/orders' \| '\/finance'/)
  assert.match(modules, /route: '\/finance'/)
  assert.match(layout, /name="finance"/)
  assert.match(layout, /name="finance-entry"/)
  assert.match(layout, /href: null/)
})
