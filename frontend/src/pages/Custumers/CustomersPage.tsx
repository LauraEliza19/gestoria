import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../services/api'

type Customer = { id: string; name: string; phone: string; email?: string | null; category?: string }

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('Carregando clientes...')

  useEffect(() => {
    apiFetch<Customer[]>('/api/customers').then((list) => { setCustomers(list); setStatus('') }).catch((error) => setStatus(error instanceof Error ? error.message : 'Não foi possível carregar os clientes.'))
  }, [])

  async function removeCustomer(customer: Customer) {
    if (!window.confirm(`Excluir o cliente "${customer.name}"?`)) return
    try {
      await apiFetch(`/api/customers/${customer.id}`, { method: 'DELETE' })
      setCustomers((current) => current.filter((item) => item.id !== customer.id))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível excluir o cliente.')
    }
  }

  const filtered = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email || ''}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">Relacionamento</p><h1>Clientes</h1><p>Consulte e mantenha sua base de clientes atualizada.</p></div><Link className="primary-button" to="/clientes/novo">Novo cliente</Link></header><section className="page-card"><input className="search-input" placeholder="Buscar por nome, telefone ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} />{status && <p className="table-status">{status}</p>}{!status && <div className="data-table"><div className="data-table-row data-table-head"><span>Nome</span><span>Telefone</span><span>E-mail</span><span>Ações</span></div>{filtered.map((customer) => <div className="data-table-row" key={customer.id}><span><strong>{customer.name}</strong><small>{customer.category || 'Consumidor final'}</small></span><span>{customer.phone}</span><span>{customer.email || 'Não informado'}</span><span className="row-actions"><Link to={`/clientes/novo?id=${customer.id}`}>Editar</Link><button onClick={() => void removeCustomer(customer)}>Excluir</button></span></div>)}{filtered.length === 0 && <p className="table-status">Nenhum cliente encontrado.</p>}</div>}</section></div>
}
