import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { DashboardPage } from '../pages/Dashboard/DashboardPage'
import { CustomerFormPage } from '../pages/Custumers/CustomerFormPage'
import { CustomersPage } from '../pages/Custumers/CustomersPage'
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
import { clearSession, getAccessToken } from '../services/session'

function ProtectedLayout() {
	if (!getAccessToken()) return <Navigate to="/login" replace />
	return <DashboardLayout />
}

function LogoutPage() {
	clearSession()
	return <Navigate to="/login" replace />
}

function PageTitle() {
	const location = useLocation()
	useEffect(() => {
		const titles: Record<string, string> = {
			'/login': 'GestorIA — Entrar', '/dashboard': 'GestorIA — Visão geral', '/clientes': 'GestorIA — Clientes',
			'/produtos': 'GestorIA — Produtos',
			'/pedidos': 'GestorIA — Pedidos',
			'/pedidos/novo': 'GestorIA — Novo pedido',
			'/orcamentos': 'GestorIA — Orçamentos',
			'/copiloto': 'GestorIA — Copiloto', '/modo-fabrica': 'GestorIA — Modo fábrica', '/notas-fiscais': 'GestorIA — Notas fiscais',
			'/empresa/editar': 'GestorIA — Empresa',
		}
		document.title = titles[location.pathname] || 'GestorIA'
	}, [location.pathname])
	return null
}

export function AppRouter() {
	return <BrowserRouter><PageTitle /><Routes>
		<Route path="/login" element={<LoginPage />} />
		<Route path="/logout" element={<LogoutPage />} />
		<Route element={<ProtectedLayout />}>
			<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/clientes" element={<CustomersPage />} />
			<Route path="/clientes/novo" element={<CustomerFormPage />} />
				<Route path="/produtos" element={<ProductsPage />} />
			<Route path="/produtos/novo" element={<ProductFormPage />} />
			<Route path="/empresa/editar" element={<CompanyPage />} />
			<Route path="/pedidos" element={<OrdersPage />} />
			<Route path="/pedidos/novo" element={<OrderFormPage />} />
			<Route path="/orcamentos" element={<QuotesPage />} />
			<Route path="/copiloto" element={<CopilotPage />} />
			<Route path="/modo-fabrica" element={<FactoryModePage />} />
			<Route path="/notas-fiscais" element={<FiscalDocumentsPage />} />
		</Route>
		<Route path="*" element={<Navigate to={getAccessToken() ? '/dashboard' : '/login'} replace />} />
	</Routes></BrowserRouter>
}
