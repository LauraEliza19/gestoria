const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const router = read('src/app/router.tsx')

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const lazyModules = {
  Financeiro: {
    folder: 'Finance',
    pages: [
      'FinancePage',
      'FinanceAccountsPage',
      'FinanceAuditPage',
      'FinanceCategoryFormPage',
      'FinanceEntryFormPage',
    ],
  },
  Fiscal: { folder: 'Fiscal', pages: ['FiscalDocumentsPage'] },
  Produção: { folder: 'FactoryMode', pages: ['FactoryModePage'] },
  Gestão: {
    folder: 'Management',
    pages: [
      'ManagementPage',
      'EmployeesPage',
      'EmployeeFormPage',
      'EmployeeProfilePage',
      'EmployeeRecordDetailPage',
      'EmployeeRecordFormPage',
      'EmploymentFormPage',
      'CostCentersPage',
      'CostCenterFormPage',
    ],
  },
  Comercial: {
    folders: { OrdersPage: 'Orders', OrderFormPage: 'Orders', QuotesPage: 'Quotes' },
    pages: ['OrdersPage', 'OrderFormPage', 'QuotesPage'],
  },
}

const lazyPages = Object.values(lazyModules).flatMap((module) =>
  module.pages.map((page) => ({ page, folder: module.folder || module.folders[page] })),
)
const lazyPageNames = new Set(lazyPages.map(({ page }) => page))

const staticImports = [
  ['DashboardPage', '../pages/Dashboard/DashboardPage'],
  ['LoginPage', '../pages/Login/LoginPage'],
  ['CustomersPage', '../pages/Customers/CustomersPage'],
  ['CustomerFormPage', '../pages/Customers/CustomerFormPage'],
  ['CustomerProfilePage', '../pages/Customers/CustomerProfilePage'],
  ['ProductsPage', '../pages/Products/ProductsPage'],
  ['ProductFormPage', '../pages/Products/ProductFormPage'],
  ['DashboardLayout', '../layouts/DashboardLayout'],
  ['SessionProvider', '../contexts/SessionContext'],
  ['PermissionGate', '../components/PermissionGate'],
]

// [path, permissão exigida (ou null), componente renderizado]
const expectedRoutes = [
  ['/login', null, 'LoginPage'],
  ['/logout', null, 'LogoutPage'],
  ['/dashboard', null, 'DashboardPage'],
  ['/auditoria', 'audit:read', 'AuditPage'],
  ['/financeiro', 'finance:read', 'FinancePage'],
  ['/financeiro/contas', 'finance:read', 'FinanceAccountsPage'],
  ['/financeiro/auditoria', 'finance:audit', 'FinanceAuditPage'],
  ['/financeiro/categorias/nova', 'finance:manage', 'FinanceCategoryFormPage'],
  ['/financeiro/categorias/:categoryId/editar', 'finance:manage', 'FinanceCategoryFormPage'],
  ['/financeiro/lancamentos/novo', 'finance:manage', 'FinanceEntryFormPage'],
  ['/financeiro/lancamentos/:entryId/editar', 'finance:manage', 'FinanceEntryFormPage'],
  ['/gestao', 'management:read', 'ManagementPage'],
  ['/gestao/funcionarios', 'management:read', 'EmployeesPage'],
  ['/gestao/funcionarios/novo', 'employees:manage', 'EmployeeFormPage'],
  ['/gestao/funcionarios/:employeeId/editar', 'employees:manage', 'EmployeeFormPage'],
  [
    '/gestao/funcionarios/:employeeId/registros/:recordId',
    'employees:manage',
    'EmployeeRecordDetailPage',
  ],
  ['/gestao/funcionarios/:employeeId/registros/novo', 'employees:manage', 'EmployeeRecordFormPage'],
  [
    '/gestao/funcionarios/:employeeId/registros/:recordId/editar',
    'employees:manage',
    'EmployeeRecordFormPage',
  ],
  ['/gestao/funcionarios/:employeeId/vinculos/novo', 'employees:manage', 'EmploymentFormPage'],
  [
    '/gestao/funcionarios/:employeeId/vinculos/:employmentId/editar',
    'employees:manage',
    'EmploymentFormPage',
  ],
  ['/gestao/funcionarios/:employeeId', 'management:read', 'EmployeeProfilePage'],
  ['/gestao/centros-de-custo', 'cost_centers:manage', 'CostCentersPage'],
  ['/gestao/centros-de-custo/novo', 'cost_centers:manage', 'CostCenterFormPage'],
  ['/gestao/centros-de-custo/:costCenterId/editar', 'cost_centers:manage', 'CostCenterFormPage'],
  ['/clientes', null, 'CustomersPage'],
  ['/clientes/novo', null, 'CustomerFormPage'],
  ['/clientes/:customerId', null, 'CustomerProfilePage'],
  ['/produtos', null, 'ProductsPage'],
  ['/produtos/novo', null, 'ProductFormPage'],
  ['/empresa/editar', 'organization:update', 'CompanyPage'],
  ['/pedidos', null, 'OrdersPage'],
  ['/pedidos/novo', null, 'OrderFormPage'],
  ['/orcamentos', null, 'QuotesPage'],
  ['/copiloto', null, 'CopilotPage'],
  ['/modo-fabrica', null, 'FactoryModePage'],
  ['/notas-fiscais', null, 'FiscalDocumentsPage'],
]

const expectedTitles = {
  '/auditoria': 'GestorIA — Central de Auditoria',
  '/login': 'GestorIA — Entrar',
  '/dashboard': 'GestorIA — Visão geral',
  '/clientes': 'GestorIA — Clientes',
  '/clientes/novo': 'GestorIA — Cadastro de cliente',
  '/produtos': 'GestorIA — Produtos',
  '/produtos/novo': 'GestorIA — Cadastro de produto',
  '/pedidos': 'GestorIA — Pedidos',
  '/pedidos/novo': 'GestorIA — Novo pedido',
  '/orcamentos': 'GestorIA — Orçamentos',
  '/copiloto': 'GestorIA — Copiloto',
  '/modo-fabrica': 'GestorIA — Produção',
  '/notas-fiscais': 'GestorIA — Notas fiscais',
  '/gestao': 'GestorIA — Gestão interna',
  '/gestao/funcionarios': 'GestorIA — Funcionários',
  '/gestao/centros-de-custo': 'GestorIA — Centros de custo',
  '/gestao/centros-de-custo/novo': 'GestorIA — Cadastrar centro de custo',
  '/gestao/funcionarios/novo': 'GestorIA — Cadastrar funcionário',
  '/empresa/editar': 'GestorIA — Empresa',
  '/financeiro': 'GestorIA — Financeiro',
  '/financeiro/auditoria': 'GestorIA — Auditoria financeira',
  '/financeiro/contas': 'GestorIA — Contas a pagar e receber',
  '/financeiro/categorias/nova': 'GestorIA — Nova categoria financeira',
  '/financeiro/lancamentos/novo': 'GestorIA — Novo lançamento financeiro',
}

const dynamicTitles = [
  'GestorIA — Perfil do cliente',
  'GestorIA — Novo registro do funcionário',
  'GestorIA — Editar registro do funcionário',
  'GestorIA — Detalhes do registro',
  'GestorIA — Novo vínculo',
  'GestorIA — Editar vínculo',
  'GestorIA — Editar centro de custo',
  'GestorIA — Editar funcionário',
  'GestorIA — Perfil do funcionário',
]

// Divide o JSX do router em blocos, um por <Route path="...">.
function parseRoutes(source) {
  const starts = [...source.matchAll(/<Route\s+path="([^"*]+)"/g)]
  return starts.map((match, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : source.length
    const block = source.slice(match.index, end)
    const permission = block.match(/<PermissionGate permission="([^"]+)">/)
    return { path: match[1], block, permission: permission ? permission[1] : null }
  })
}

test('os cinco módulos usam React.lazy com adaptação de named export', () => {
  assert.match(router, /import \{[^}]*\blazy\b[^}]*\} from 'react'/)

  for (const [label, module] of Object.entries(lazyModules)) {
    for (const page of module.pages) {
      const folder = module.folder || module.folders[page]
      const pattern = new RegExp(
        `const ${page} = lazy\\(\\(\\) =>\\s*import\\('\\.\\./pages/${folder}/${page}'\\)` +
          `\\.then\\(\\(module\\) => \\(\\{\\s*default: module\\.${page},?\\s*\\}\\)\\),?\\s*\\)`,
      )
      assert.match(router, pattern, `${label}: ${page} deveria ser carregado com lazy()`)
    }
  }
})

test('router não importa estaticamente nenhum dos módulos sob demanda', () => {
  const staticImportLines = router.split('\n').filter((line) => /^import\s/.test(line))

  for (const line of staticImportLines) {
    assert.doesNotMatch(
      line,
      /\.\.\/pages\/(Finance|Fiscal|FactoryMode|Management|Orders|Quotes)\//,
      `import estático indevido: ${line}`,
    )
  }

  for (const { page } of lazyPages) {
    assert.doesNotMatch(router, new RegExp(`^import \\{[^}]*\\b${page}\\b[^}]*\\}`, 'm'))
  }
})

test('dashboard, login, sessão, layout, permissões, clientes e produtos seguem estáticos', () => {
  for (const [name, source] of staticImports) {
    assert.match(
      router,
      new RegExp(`^import \\{ ${name} \\} from '${escape(source)}'$`, 'm'),
      `${name} deveria permanecer no pacote inicial`,
    )
  }
})

test('rotas sob demanda são envolvidas por Suspense com fallback acessível', () => {
  assert.match(router, /import \{[^}]*\bSuspense\b[^}]*\} from 'react'/)
  assert.match(router, /<Suspense fallback=\{<RouteLoadingFallback \/>\}>\{children\}<\/Suspense>/)

  const fallback = router.match(/function RouteLoadingFallback\(\) \{[\s\S]*?\n\}/)
  assert.ok(fallback, 'RouteLoadingFallback deveria existir')
  assert.match(fallback[0], /role="status"/)
  assert.match(fallback[0], /aria-live="polite"/)
  assert.match(fallback[0], /Carregando módulo, aguarde\.\.\./)

  for (const route of parseRoutes(router)) {
    const component = route.block.match(/<([A-Z]\w+) \/>/)
    if (component && lazyPageNames.has(component[1])) {
      assert.match(
        route.block,
        new RegExp(`<LazyRoute>\\s*<${component[1]} />\\s*</LazyRoute>`),
        `${route.path} deveria renderizar ${component[1]} dentro de <LazyRoute>`,
      )
    }
  }
})

test('falha ao baixar um chunk mostra mensagem amigável com opção de recarregar', () => {
  assert.match(router, /class RouteErrorBoundary extends Component</)
  assert.match(router, /static getDerivedStateFromError\(/)
  assert.match(router, /role="alert"/)
  assert.match(router, /Não foi possível carregar esta página/)
  assert.match(router, /function isChunkLoadError\(error: Error\)/)
  assert.match(router, /Failed to fetch dynamically imported module/)
  assert.match(router, /Ocorreu um erro ao exibir esta página/)
  assert.match(router, /window\.location\.reload\(\)/)
  assert.match(router, /Tentar novamente/)
  assert.match(
    router,
    /<RouteErrorBoundary resetKey=\{location\.pathname\}>\s*<Suspense fallback=/,
    'o Error Boundary deveria envolver o Suspense',
  )
})

test('todas as rotas e controles de permissão foram preservados', () => {
  const routes = parseRoutes(router)

  assert.deepEqual(
    routes.map((route) => route.path),
    expectedRoutes.map(([routePath]) => routePath),
  )

  for (const [routePath, permission, component] of expectedRoutes) {
    const route = routes.find((item) => item.path === routePath)
    assert.equal(route.permission, permission, `permissão de ${routePath}`)
    assert.match(route.block, new RegExp(`<${component} />`), `componente de ${routePath}`)

    if (permission) {
      assert.match(
        route.block,
        new RegExp(`<PermissionGate permission="${permission}">[\\s\\S]*<${component} />`),
        `${component} deveria continuar dentro do PermissionGate em ${routePath}`,
      )
    }
  }

  assert.match(
    router,
    /<Route path="\*" element=\{<Navigate to=\{'\/dashboard'\} replace \/>\} \/>/,
  )
  assert.match(router, /<Route element=\{<ProtectedLayout \/>\}>/)
})

test('títulos definidos em PageTitle foram preservados', () => {
  for (const [routePath, title] of Object.entries(expectedTitles)) {
    assert.match(router, new RegExp(`'${escape(routePath)}': '${escape(title)}',`))
  }

  for (const title of dynamicTitles) {
    assert.match(router, new RegExp(`title = '${escape(title)}'`))
  }

  assert.match(router, /document\.title = title/)
})
