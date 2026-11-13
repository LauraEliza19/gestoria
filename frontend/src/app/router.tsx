import { AuditPage } from '../pages/Audit/AuditPage'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Component, Suspense, lazy, useEffect, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { DashboardPage } from '../pages/Dashboard/DashboardPage'
import { CustomerFormPage } from '../pages/Customers/CustomerFormPage'
import { CustomerProfilePage } from '../pages/Customers/CustomerProfilePage'
import { CustomersPage } from '../pages/Customers/CustomersPage'
import { ProductFormPage } from '../pages/Products/ProductFormPage'
import { ProductsPage } from '../pages/Products/ProductsPage'
import { CompanyPage } from '../pages/Company/CompanyPage'
import { CopilotPage } from '../pages/Copilot/CopilotPage'
import { LoginPage } from '../pages/Login/LoginPage'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { clearSession, logoutSession } from '../services/session'
import { SessionProvider } from '../contexts/SessionContext'
import { PermissionGate } from '../components/PermissionGate'

// Módulos carregados sob demanda: cada página vira um chunk separado e só é baixada
// quando a rota é acessada. Dashboard, Login, Clientes e Produtos seguem no pacote inicial.

// Financeiro
const FinancePage = lazy(() =>
  import('../pages/Finance/FinancePage').then((module) => ({ default: module.FinancePage })),
)
const FinanceCategoryFormPage = lazy(() =>
  import('../pages/Finance/FinanceCategoryFormPage').then((module) => ({
    default: module.FinanceCategoryFormPage,
  })),
)
const FinanceEntryFormPage = lazy(() =>
  import('../pages/Finance/FinanceEntryFormPage').then((module) => ({
    default: module.FinanceEntryFormPage,
  })),
)
const FinanceAuditPage = lazy(() =>
  import('../pages/Finance/FinanceAuditPage').then((module) => ({
    default: module.FinanceAuditPage,
  })),
)
const FinanceAccountsPage = lazy(() =>
  import('../pages/Finance/FinanceAccountsPage').then((module) => ({
    default: module.FinanceAccountsPage,
  })),
)

// Fiscal
const FiscalDocumentsPage = lazy(() =>
  import('../pages/Fiscal/FiscalDocumentsPage').then((module) => ({
    default: module.FiscalDocumentsPage,
  })),
)

// Produção
const FactoryModePage = lazy(() =>
  import('../pages/FactoryMode/FactoryModePage').then((module) => ({
    default: module.FactoryModePage,
  })),
)

// Gestão
const ManagementPage = lazy(() =>
  import('../pages/Management/ManagementPage').then((module) => ({
    default: module.ManagementPage,
  })),
)
const EmployeesPage = lazy(() =>
  import('../pages/Management/EmployeesPage').then((module) => ({ default: module.EmployeesPage })),
)
const EmployeeRecordDetailPage = lazy(() =>
  import('../pages/Management/EmployeeRecordDetailPage').then((module) => ({
    default: module.EmployeeRecordDetailPage,
  })),
)
const EmployeeProfilePage = lazy(() =>
  import('../pages/Management/EmployeeProfilePage').then((module) => ({
    default: module.EmployeeProfilePage,
  })),
)
const EmployeeRecordFormPage = lazy(() =>
  import('../pages/Management/EmployeeRecordFormPage').then((module) => ({
    default: module.EmployeeRecordFormPage,
  })),
)
const EmploymentFormPage = lazy(() =>
  import('../pages/Management/EmploymentFormPage').then((module) => ({
    default: module.EmploymentFormPage,
  })),
)
const CostCentersPage = lazy(() =>
  import('../pages/Management/CostCentersPage').then((module) => ({
    default: module.CostCentersPage,
  })),
)
const EmployeeFormPage = lazy(() =>
  import('../pages/Management/EmployeeFormPage').then((module) => ({
    default: module.EmployeeFormPage,
  })),
)
const CostCenterFormPage = lazy(() =>
  import('../pages/Management/CostCenterFormPage').then((module) => ({
    default: module.CostCenterFormPage,
  })),
)

// Comercial (pedidos e orçamentos)
const OrdersPage = lazy(() =>
  import('../pages/Orders/OrdersPage').then((module) => ({ default: module.OrdersPage })),
)
const OrderFormPage = lazy(() =>
  import('../pages/Orders/OrderFormPage').then((module) => ({ default: module.OrderFormPage })),
)
const QuotesPage = lazy(() =>
  import('../pages/Quotes/QuotesPage').then((module) => ({ default: module.QuotesPage })),
)

function RouteLoadingFallback() {
  return (
    <div
      className="mx-auto grid min-h-[50vh] w-full max-w-[1180px] place-items-center p-7"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm text-muted">Carregando módulo, aguarde...</p>
    </div>
  )
}

// Mensagens dos navegadores quando o download de um chunk falha
// (Chrome/Edge, Firefox, Safari) e o erro de preload emitido pelo Vite.
const CHUNK_LOAD_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload/i

function isChunkLoadError(error: Error) {
  return CHUNK_LOAD_ERROR.test(error.message)
}

type RouteErrorBoundaryProps = {
  children: ReactNode
  resetKey: string
}

type RouteErrorBoundaryState = {
  error: Error | null
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Falha ao carregar o módulo da rota.', error, info.componentStack)
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    const chunkFailed = isChunkLoadError(this.state.error)

    return (
      <section
        className="mx-auto grid min-h-[50vh] w-full max-w-lg place-items-center p-7"
        role="alert"
        aria-labelledby="route-load-error-title"
      >
        <div className="w-full rounded-xl border border-line bg-white p-7 text-center">
          <h1 className="font-display text-2xl font-semibold" id="route-load-error-title">
            {chunkFailed
              ? 'Não foi possível carregar esta página'
              : 'Ocorreu um erro ao exibir esta página'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {chunkFailed
              ? 'Verifique sua conexão com a internet e tente novamente. Se o sistema foi atualizado recentemente, recarregar a página resolve o problema.'
              : 'Recarregue a página para tentar novamente. Se o erro continuar, avise o suporte.'}
          </p>
          <button
            className="primary-button mt-6"
            type="button"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </div>
      </section>
    )
  }
}

function LazyRoute({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <RouteErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  )
}

function ProtectedLayout() {
  return (
    <SessionProvider>
      <DashboardLayout />
    </SessionProvider>
  )
}

function LogoutPage() {
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    logoutSession().catch((err: Error) => setError(err.message))
  }, [attempt])
  return (
    <main className="grid min-h-screen place-items-center bg-paper p-6">
      <div>
        <p role="status">{error || 'Encerrando sessão...'}</p>
        {error && (
          <button
            className="primary-button mt-4"
            onClick={() => {
              setError('')
              setAttempt((value) => value + 1)
            }}
          >
            Tentar novamente
          </button>
        )}
      </div>
    </main>
  )
}

function PageTitle() {
  const location = useLocation()

  useEffect(() => {
    const titles: Record<string, string> = {
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

    const isCustomerProfile =
      /^\/clientes\/[^/]+$/.test(location.pathname) && location.pathname !== '/clientes/novo'

    const isEmployeeEdit = /^\/gestao\/funcionarios\/[^/]+\/editar$/.test(location.pathname)

    const isEmployeeProfile =
      /^\/gestao\/funcionarios\/[^/]+$/.test(location.pathname) &&
      location.pathname !== '/gestao/funcionarios/novo'

    const isEmployeeRecordCreate = /^\/gestao\/funcionarios\/[^/]+\/registros\/novo$/.test(
      location.pathname,
    )

    const isEmployeeRecordEdit = /^\/gestao\/funcionarios\/[^/]+\/registros\/[^/]+\/editar$/.test(
      location.pathname,
    )
    const isEmployeeRecordDetail = /^\/gestao\/funcionarios\/[^/]+\/registros\/[^/]+$/.test(
      location.pathname,
    )
    const isEmploymentCreate = /^\/gestao\/funcionarios\/[^/]+\/vinculos\/novo$/.test(
      location.pathname,
    )

    const isEmploymentEdit = /^\/gestao\/funcionarios\/[^/]+\/vinculos\/[^/]+\/editar$/.test(
      location.pathname,
    )

    const isCostCenterEdit = /^\/gestao\/centros-de-custo\/[^/]+\/editar$/.test(location.pathname)

    let title = titles[location.pathname] || 'GestorIA'

    if (isCustomerProfile) {
      title = 'GestorIA — Perfil do cliente'
    } else if (isEmployeeRecordCreate) {
      title = 'GestorIA — Novo registro do funcionário'
    } else if (isEmployeeRecordEdit) {
      title = 'GestorIA — Editar registro do funcionário'
    } else if (isEmployeeRecordDetail) {
      title = 'GestorIA — Detalhes do registro'
    } else if (isEmploymentCreate) {
      title = 'GestorIA — Novo vínculo'
    } else if (isEmploymentEdit) {
      title = 'GestorIA — Editar vínculo'
    } else if (isCostCenterEdit) {
      title = 'GestorIA — Editar centro de custo'
    } else if (isEmployeeEdit) {
      title = 'GestorIA — Editar funcionário'
    } else if (isEmployeeProfile) {
      title = 'GestorIA — Perfil do funcionário'
    }

    document.title = title
  }, [location.pathname])

  return null
}

export function AppRouter() {
  useEffect(() => {
    clearSession()
  }, [])
  return (
    <BrowserRouter>
      <PageTitle />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/auditoria"
            element={
              <PermissionGate permission="audit:read">
                <AuditPage />
              </PermissionGate>
            }
          />
          <Route
            path="/financeiro"
            element={
              <PermissionGate permission="finance:read">
                <LazyRoute>
                  <FinancePage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/financeiro/contas"
            element={
              <PermissionGate permission="finance:read">
                <LazyRoute>
                  <FinanceAccountsPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/financeiro/auditoria"
            element={
              <PermissionGate permission="finance:audit">
                <LazyRoute>
                  <FinanceAuditPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/financeiro/categorias/nova"
            element={
              <PermissionGate permission="finance:manage">
                <LazyRoute>
                  <FinanceCategoryFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/financeiro/categorias/:categoryId/editar"
            element={
              <PermissionGate permission="finance:manage">
                <LazyRoute>
                  <FinanceCategoryFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/financeiro/lancamentos/novo"
            element={
              <PermissionGate permission="finance:manage">
                <LazyRoute>
                  <FinanceEntryFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/financeiro/lancamentos/:entryId/editar"
            element={
              <PermissionGate permission="finance:manage">
                <LazyRoute>
                  <FinanceEntryFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/gestao"
            element={
              <PermissionGate permission="management:read">
                <LazyRoute>
                  <ManagementPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/funcionarios"
            element={
              <PermissionGate permission="management:read">
                <LazyRoute>
                  <EmployeesPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/funcionarios/novo"
            element={
              <PermissionGate permission="employees:manage">
                <LazyRoute>
                  <EmployeeFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />

          <Route
            path="/gestao/funcionarios/:employeeId/editar"
            element={
              <PermissionGate permission="employees:manage">
                <LazyRoute>
                  <EmployeeFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/funcionarios/:employeeId/registros/:recordId"
            element={
              <PermissionGate permission="employees:manage">
                <LazyRoute>
                  <EmployeeRecordDetailPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/funcionarios/:employeeId/registros/novo"
            element={
              <PermissionGate permission="employees:manage">
                <LazyRoute>
                  <EmployeeRecordFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />

          <Route
            path="/gestao/funcionarios/:employeeId/registros/:recordId/editar"
            element={
              <PermissionGate permission="employees:manage">
                <LazyRoute>
                  <EmployeeRecordFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/funcionarios/:employeeId/vinculos/novo"
            element={
              <PermissionGate permission="employees:manage">
                <LazyRoute>
                  <EmploymentFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />

          <Route
            path="/gestao/funcionarios/:employeeId/vinculos/:employmentId/editar"
            element={
              <PermissionGate permission="employees:manage">
                <LazyRoute>
                  <EmploymentFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/funcionarios/:employeeId"
            element={
              <PermissionGate permission="management:read">
                <LazyRoute>
                  <EmployeeProfilePage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/centros-de-custo"
            element={
              <PermissionGate permission="cost_centers:manage">
                <LazyRoute>
                  <CostCentersPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/centros-de-custo/novo"
            element={
              <PermissionGate permission="cost_centers:manage">
                <LazyRoute>
                  <CostCenterFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />

          <Route
            path="/gestao/centros-de-custo/:costCenterId/editar"
            element={
              <PermissionGate permission="cost_centers:manage">
                <LazyRoute>
                  <CostCenterFormPage />
                </LazyRoute>
              </PermissionGate>
            }
          />
          <Route path="/clientes" element={<CustomersPage />} />
          <Route path="/clientes/novo" element={<CustomerFormPage />} />
          <Route path="/clientes/:customerId" element={<CustomerProfilePage />} />
          <Route path="/produtos" element={<ProductsPage />} />
          <Route path="/produtos/novo" element={<ProductFormPage />} />
          <Route
            path="/empresa/editar"
            element={
              <PermissionGate permission="organization:update">
                <CompanyPage />
              </PermissionGate>
            }
          />
          <Route
            path="/pedidos"
            element={
              <LazyRoute>
                <OrdersPage />
              </LazyRoute>
            }
          />
          <Route
            path="/pedidos/novo"
            element={
              <LazyRoute>
                <OrderFormPage />
              </LazyRoute>
            }
          />
          <Route
            path="/orcamentos"
            element={
              <LazyRoute>
                <QuotesPage />
              </LazyRoute>
            }
          />
          <Route path="/copiloto" element={<CopilotPage />} />
          <Route
            path="/modo-fabrica"
            element={
              <LazyRoute>
                <FactoryModePage />
              </LazyRoute>
            }
          />
          <Route
            path="/notas-fiscais"
            element={
              <LazyRoute>
                <FiscalDocumentsPage />
              </LazyRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to={'/dashboard'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
