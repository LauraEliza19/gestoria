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
      '/produtos': 'GestorIA — Produtos',
      '/pedidos': 'GestorIA — Pedidos',
      '/pedidos/novo': 'GestorIA — Novo pedido',
      '/orcamentos': 'GestorIA — Orçamentos',
      '/copiloto': 'GestorIA — Copiloto',
      '/modo-fabrica': 'GestorIA — Produção',
      '/notas-fiscais': 'GestorIA — Notas fiscais',
      '/empresa/editar': 'GestorIA — Empresa',
      '/clientes/novo': 'GestorIA — Cadastro de cliente',
      '/produtos/novo': 'GestorIA — Cadastro de produto',
    }
    const isCustomerProfile =
      /^\/clientes\/[^/]+$/.test(location.pathname) && location.pathname !== '/clientes/novo'

    document.title = isCustomerProfile
      ? 'GestorIA — Perfil do cliente'
      : titles[location.pathname] || 'GestorIA'
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
