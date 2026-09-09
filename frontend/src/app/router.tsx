import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardPage } from '../pages/Dashboard/DashboardPage'
import { CustomerFormPage } from '../pages/Custumers/CustomerFormPage'
import { CustomersPage } from '../pages/Custumers/CustomersPage'
import { ProductFormPage } from '../pages/Products/ProductFormPage'
import { ProductsPage } from '../pages/Products/ProductsPage'
import { CompanyPage } from '../pages/Company/CompanyPage'
import { OrdersPage } from '../pages/Orders/OrdersPage'
import { QuotesPage } from '../pages/Quotes/QuotesPage'
import { CopilotPage } from '../pages/Copilot/CopilotPage'
import { FactoryModePage } from '../pages/FactoryMode/FactoryModePage'
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

export function AppRouter() {
	return <BrowserRouter><Routes>
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
			<Route path="/orcamentos" element={<QuotesPage />} />
			<Route path="/copiloto" element={<CopilotPage />} />
			<Route path="/modo-fabrica" element={<FactoryModePage />} />
		</Route>
		<Route path="*" element={<Navigate to={getAccessToken() ? '/dashboard' : '/login'} replace />} />
	</Routes></BrowserRouter>
}
