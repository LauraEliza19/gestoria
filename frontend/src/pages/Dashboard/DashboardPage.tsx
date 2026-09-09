import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession, type Session } from '../../services/auth.service'
import { apiFetch } from '../../services/api'

type Item = { id: string; name: string; phone?: string; price?: string; stock_quantity?: string }

export function DashboardPage() {
	const [session, setSession] = useState<Session | null>(null)
	const [customers, setCustomers] = useState<Item[]>([])
	const [products, setProducts] = useState<Item[]>([])
	const [error, setError] = useState('')
	useEffect(() => { Promise.all([getSession(), apiFetch<Item[]>('/api/customers'), apiFetch<Item[]>('/api/products')]).then(([me, customerList, productList]) => { setSession(me); setCustomers(customerList); setProducts(productList) }).catch((requestError) => setError(requestError.message)) }, [])
	const firstName = session?.full_name.split(' ')[0] || 'gestor'
	return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">Visão geral</p><h1>Olá, {firstName}.</h1><p>Acompanhe os dados principais da sua empresa.</p></div><Link className="primary-button" to="/copiloto">Abrir copiloto</Link></header>
		{error && <p className="error-banner">{error}</p>}
		<div className="metric-grid"><article><span>Clientes cadastrados</span><strong>{customers.length}</strong><Link to="/clientes/novo">Gerenciar clientes</Link></article><article><span>Produtos cadastrados</span><strong>{products.length}</strong><Link to="/produtos/novo">Gerenciar produtos</Link></article><article><span>Organização</span><strong>{session?.organization?.name || 'Configurada'}</strong><Link to="/empresa/editar">Editar empresa</Link></article></div>
		<section className="page-card"><div className="section-heading"><div><p className="eyebrow">Acesso rápido</p><h2>Continue trabalhando</h2></div></div><div className="quick-grid"><Link to="/clientes/novo">Cadastrar cliente <span>+</span></Link><Link to="/produtos/novo">Cadastrar produto <span>+</span></Link><Link to="/pedidos">Ver pedidos <span>→</span></Link></div></section>
	</div>
}
