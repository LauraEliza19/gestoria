import { NavLink, Outlet } from 'react-router-dom'
import { Building2, ClipboardList, FileText, ChefHat, LayoutDashboard, LogOut, Package, ReceiptText, Sparkles, Users } from 'lucide-react'
import { clearSession } from '../services/session'

export function DashboardLayout() {
	const links = [
		{ to: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
		{ to: '/clientes', label: 'Clientes', icon: Users },
		{ to: '/produtos', label: 'Produtos', icon: Package },
		{ to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
		{ to: '/orcamentos', label: 'Orçamentos', icon: FileText },
		{ to: '/copiloto', label: 'Copiloto', icon: Sparkles },
		{ to: '/modo-fabrica', label: 'Cozinha', icon: ChefHat },
		{ to: '/notas-fiscais', label: 'Notas fiscais', icon: ReceiptText },
		{ to: '/empresa/editar', label: 'Empresa', icon: Building2 },
	]
	return <div className="app-shell min-h-screen bg-paper text-ink md:flex">
		<aside className="sidebar flex w-full flex-col bg-[#111936] px-4 py-5 text-[#dce4ff] md:min-h-screen md:w-[230px] md:flex-none md:px-[18px] md:py-7">
			<div className="brand mb-5 flex items-center gap-3 px-3 text-[23px] font-bold tracking-[-.04em] md:mb-11"><span className="brand-mark"><span /></span>Gestor<span className="brand-accent">IA</span></div>
			<nav className="flex gap-1 overflow-x-auto md:grid" aria-label="Navegação principal">{links.map(({ to, label, icon: Icon }) => <NavLink className="group relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-[#aeb9dd] no-underline transition-colors hover:bg-[#293a89] hover:text-white" key={to} to={to} end={to === '/dashboard'}>{({ isActive }) => <><Icon className="nav-icon" size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>{isActive && <span className="nav-active-indicator" aria-hidden="true" />}</>}</NavLink>)}</nav>
			<button className="logout-link mt-5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-[#aeb9dd] transition-colors hover:bg-[#293a89] hover:text-white md:mt-auto" onClick={() => { clearSession(); window.location.href = '/login' }}><LogOut className="nav-icon" size={18} strokeWidth={1.8} aria-hidden="true" /><span>Sair</span></button>
		</aside>
		<main className="app-content min-w-0 flex-1"><Outlet /></main>
	</div>
}
