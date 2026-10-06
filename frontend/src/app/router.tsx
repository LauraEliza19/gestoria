import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { DashboardPage } from '../pages/Dashboard/DashboardPage'
import { CustomerFormPage } from '../pages/Customers/CustomerFormPage'
import { CustomerProfilePage } from '../pages/Customers/CustomerProfilePage'
import { CustomersPage } from '../pages/Customers/CustomersPage'
import { ProductFormPage } from '../pages/Products/ProductFormPage'
import { ProductsPage } from '../pages/Products/ProductsPage'
import { CompanyPage } from '../pages/Company/CompanyPage'
import { OrdersPage } from '../pages/Orders/OrdersPage'
import { OrderFormPage } from '../pages/Orders/OrderFormPage'
import { QuotesPage } from '../pages/Quotes/QuotesPage'
import { CopilotPage } from '../pages/Copilot/CopilotPage'
import { FactoryModePage } from '../pages/FactoryMode/FactoryModePage'
import { FiscalDocumentsPage } from '../pages/Fiscal/FiscalDocumentsPage'
import { LoginPage } from '../pages/Login/LoginPage'
import { ManagementPage } from '../pages/Management/ManagementPage'
import { EmployeesPage } from '../pages/Management/EmployeesPage'
import { EmployeeProfilePage } from '../pages/Management/EmployeeProfilePage'
import { EmploymentFormPage } from '../pages/Management/EmploymentFormPage'
import { CostCentersPage } from '../pages/Management/CostCentersPage'
import { EmployeeFormPage } from '../pages/Management/EmployeeFormPage'
import { CostCenterFormPage } from '../pages/Management/CostCenterFormPage'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { clearSession, logoutSession } from '../services/session'
import { SessionProvider } from '../contexts/SessionContext'
import { PermissionGate } from '../components/PermissionGate'

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
    }

    const isCustomerProfile =
      /^\/clientes\/[^/]+$/.test(location.pathname) && location.pathname !== '/clientes/novo'

    const isEmployeeEdit = /^\/gestao\/funcionarios\/[^/]+\/editar$/.test(location.pathname)

    const isEmployeeProfile =
      /^\/gestao\/funcionarios\/[^/]+$/.test(location.pathname) &&
      location.pathname !== '/gestao/funcionarios/novo'

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
            path="/gestao"
            element={
              <PermissionGate permission="management:read">
                <ManagementPage />
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/funcionarios"
            element={
              <PermissionGate permission="management:read">
                <EmployeesPage />
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/funcionarios/novo"
            element={
              <PermissionGate permission="employees:manage">
                <EmployeeFormPage />
              </PermissionGate>
            }
          />

          <Route
            path="/gestao/funcionarios/:employeeId/editar"
            element={
              <PermissionGate permission="employees:manage">
                <EmployeeFormPage />
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/funcionarios/:employeeId/vinculos/novo"
            element={
              <PermissionGate permission="employees:manage">
                <EmploymentFormPage />
              </PermissionGate>
            }
          />

          <Route
            path="/gestao/funcionarios/:employeeId/vinculos/:employmentId/editar"
            element={
              <PermissionGate permission="employees:manage">
                <EmploymentFormPage />
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/funcionarios/:employeeId"
            element={
              <PermissionGate permission="management:read">
                <EmployeeProfilePage />
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/centros-de-custo"
            element={
              <PermissionGate permission="cost_centers:manage">
                <CostCentersPage />
              </PermissionGate>
            }
          />
          <Route
            path="/gestao/centros-de-custo/novo"
            element={
              <PermissionGate permission="cost_centers:manage">
                <CostCenterFormPage />
              </PermissionGate>
            }
          />

          <Route
            path="/gestao/centros-de-custo/:costCenterId/editar"
            element={
              <PermissionGate permission="cost_centers:manage">
                <CostCenterFormPage />
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
          <Route path="/pedidos" element={<OrdersPage />} />
          <Route path="/pedidos/novo" element={<OrderFormPage />} />
          <Route path="/orcamentos" element={<QuotesPage />} />
          <Route path="/copiloto" element={<CopilotPage />} />
          <Route path="/modo-fabrica" element={<FactoryModePage />} />
          <Route path="/notas-fiscais" element={<FiscalDocumentsPage />} />
        </Route>
        <Route path="*" element={<Navigate to={'/dashboard'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
