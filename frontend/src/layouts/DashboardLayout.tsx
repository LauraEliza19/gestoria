import { NavLink, Outlet } from 'react-router-dom'
import { Building2, ClipboardList, FileText, Factory, LayoutDashboard, LogOut, Package, ReceiptText, Sparkles, Users } from 'lucide-react'
import { clearSession } from '../services/session'

export function DashboardLayout() {
	const links = [
		{ to: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
		{ to: '/clientes', label: 'Clientes', icon: Users },
		{ to: '/produtos', label: 'Produtos', icon: Package },
		{ to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
		{ to: '/orcamentos', label: 'Orçamentos', icon: FileText },
		{ to: '/copiloto', label: 'Copiloto', icon: Sparkles },
		{ to: '/modo-fabrica', label: 'Modo fábrica', icon: Factory },
		{ to: '/notas-fiscais', label: 'Notas fiscais', icon: ReceiptText },
		{ to: '/empresa/editar', label: 'Empresa', icon: Building2 },
	]
	return <div className="app-shell">
		<aside className="sidebar">
			<div className="brand"><span className="brand-mark"><span /></span>Gestor<span className="brand-accent">IA</span></div>
			<nav aria-label="Navegação principal">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/dashboard'}>{({ isActive }) => <><Icon className="nav-icon" size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>{isActive && <span className="nav-active-indicator" aria-hidden="true" />}</>}</NavLink>)}</nav>
			<button className="logout-link" onClick={() => { clearSession(); window.location.href = '/login' }}><LogOut className="nav-icon" size={18} strokeWidth={1.8} aria-hidden="true" /><span>Sair</span></button>
		</aside>
		<main className="app-content"><Outlet /></main>
	</div>
}
