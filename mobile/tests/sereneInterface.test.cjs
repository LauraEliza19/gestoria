const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

const read = (relative) =>
  fs.readFileSync(path.join(root, relative), 'utf8')

const tokens = read('src/theme/tokens.ts')
const rootLayout = read('src/app/_layout.tsx')
const appLayout = read('src/app/(app)/_layout.tsx')
const alertsRoute = read('src/app/(app)/alerts.tsx')
const modulesRoute = read('src/app/(app)/modules.tsx')

const home = read(
  'src/features/home/screens/HomeScreen.tsx'
)
const alerts = read(
  'src/features/alerts/screens/AlertsScreen.tsx'
)
const modules = read(
  'src/features/modules/screens/ModulesScreen.tsx'
)
const orders = read(
  'src/features/orders/screens/OrdersScreen.tsx'
)
const copilot = read(
  'src/features/copilot/screens/CopilotScreen.tsx'
)
const account = read(
  'src/features/account/screens/AccountScreen.tsx'
)
const finance = read(
  'src/features/finance/screens/FinanceScreen.tsx'
)
const login = read(
  'src/features/auth/screens/LoginScreen.tsx'
)
const loading = read('src/app/loading.tsx')
const sereneLayout = read(
  'src/components/serene/SereneLayout.tsx'
)

test('serene theme exposes the shared GestorIA palette', () => {
  const fields = [
    'background',
    'backgroundSoft',
    'surface',
    'surfaceElevated',
    'surfaceMuted',
    'primary',
    'primaryPressed',
    'brandCyan',
    'text',
    'textMuted',
    'textSubtle',
    'border',
    'sheet',
    'sheetSurface',
    'sheetText',
    'sheetTextMuted',
    'sheetBorder',
    'success',
    'warning',
    'danger',
    'tabBar',
  ]

  assert.match(tokens, /export const sereneColors/)

  for (const field of fields) {
    assert.ok(
      tokens.includes(`${field}:`),
      `missing serene color: ${field}`
    )
  }
})

test('authenticated application uses the serene background', () => {
  assert.match(rootLayout, /name="\(app\)"/)
  assert.match(
    rootLayout,
    /backgroundColor:\s*sereneColors\.background/
  )
})

test('bottom navigation exposes the five executive destinations', () => {
  const expectedTabs = [
    'name="index"',
    'name="alerts"',
    'name="copilot"',
    'name="modules"',
    'name="account"',
  ]

  let previousIndex = -1

  for (const tab of expectedTabs) {
    const currentIndex = appLayout.indexOf(tab)

    assert.ok(currentIndex >= 0, `missing tab: ${tab}`)
    assert.ok(
      currentIndex > previousIndex,
      `tab is out of order: ${tab}`
    )

    previousIndex = currentIndex
  }

  assert.match(
    appLayout,
    /backgroundColor:\s*sereneColors\.sheetSurface/
  )
  assert.match(
    appLayout,
    /borderTopColor:\s*sereneColors\.sheetBorder/
  )
  assert.match(appLayout, /useSafeAreaInsets/)
  assert.match(appLayout, /tabBarShowLabel:\s*false/)
  assert.match(appLayout, /position:\s*'absolute'/)
  assert.match(appLayout, /styles\.iconContainer/)
  assert.match(appLayout, /styles\.activeIndicator/)
})

test('orders remains available without occupying a tab', () => {
  assert.match(appLayout, /name="orders"/)
  assert.match(appLayout, /href:\s*null/)
})

test('alerts and modules routes export their feature screens', () => {
  assert.match(
    alertsRoute,
    /AlertsScreen as default/
  )
  assert.match(
    modulesRoute,
    /ModulesScreen as default/
  )
})

test('home presents summary before the operational sheet', () => {
  const metricsIndex = home.indexOf(
    '<View style={styles.metricsPanel}>'
  )
  const sheetIndex = home.indexOf(
    '<View style={styles.sheet}>'
  )
  const focusIndex = home.indexOf('<FocusCard')
  const prioritiesIndex = home.search(
    />\s*Prioridades\s*<\/Text>/
  )

  assert.ok(metricsIndex >= 0)
  assert.ok(sheetIndex > metricsIndex)
  assert.ok(focusIndex > sheetIndex)
  assert.ok(prioritiesIndex > focusIndex)
})

test('alert center consumes real dashboard alerts', () => {
  assert.match(alerts, /useExecutiveDashboard/)
  assert.match(alerts, /overview\.alerts\.map/)
  assert.match(alerts, /item\.description/)
  assert.match(alerts, /item\.impact/)
  assert.match(alerts, /item\.source/)
  assert.match(alerts, /item\.action_label/)
})

test('modules catalog identifies available and future areas', () => {
  const moduleNames = [
    'Clientes',
    'Pedidos',
    'Orçamentos',
    'Produtos',
    'Produção',
    'Estoque',
    'Fiscal',
    'Financeiro',
    'Gestão interna',
    'Empresa',
  ]

  for (const moduleName of moduleNames) {
    assert.ok(
      modules.includes(moduleName),
      `missing module: ${moduleName}`
    )
  }

  assert.match(modules, /route:\s*'\/orders'/)
  assert.match(modules, /Disponível/)
  assert.match(modules, /Em integração/)
})

test('functional authenticated screens use the serene theme', () => {
  const screens = {
    home,
    alerts,
    modules,
    orders,
    copilot,
    account,
  }

  for (const [name, source] of Object.entries(screens)) {
    assert.match(
      source,
      /sereneColors\.background/,
      `${name} does not use the serene background`
    )

    assert.match(
      source,
      /<StatusBar style="light" \/>/,
      `${name} does not use a light status bar`
    )
  }
})

test('orders keeps search filters and real service integration', () => {
  assert.match(orders, /listOrders\(\)/)
  assert.match(orders, /normalizeSearch/)
  assert.match(orders, /Cliente, pedido ou produto/)
  assert.match(orders, /accessibilityRole="radiogroup"/)
  assert.match(orders, /onRefresh=/)
})

test('copilot keeps conversation protections after theming', () => {
  assert.match(copilot, /maxLength=\{500\}/)
  assert.match(copilot, /editable=\{!sending\}/)
  assert.match(copilot, /Contexto protegido/)
  assert.match(copilot, /Nova conversa/)
  assert.match(copilot, /retryMessage/)
})

test('account keeps protected sign out behavior', () => {
  assert.match(account, /await signOut\(\)/)
  assert.match(account, /disabled=\{isLoading\}/)
  assert.match(account, /Sair da conta/)
  assert.match(account, /Sessão protegida/)
})

test('mobile typography uses a restrained scale', () => {
  const expectedScale = [
    /caption:\s*11/,
    /bodySmall:\s*13/,
    /body:\s*15/,
    /subtitle:\s*17/,
    /title:\s*22/,
    /display:\s*30/,
  ]

  for (const token of expectedScale) {
    assert.match(tokens, token)
  }

  const surfaces = [
    sereneLayout,
    loading,
    login,
    home,
    alerts,
    modules,
    orders,
    copilot,
    account,
    finance,
  ]

  for (const surface of surfaces) {
    assert.doesNotMatch(surface, /fontWeight:\s*'(700|800)'/)
  }
})