import { useEffect, useState } from 'react'
import { apiFetch } from '../../services/api'

type Order = { id: string; customer_id: string; customer_name: string; status: string; total_amount: string; items: { product_name: string; quantity: string }[]; created_at: string }

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [status, setStatus] = useState('Carregando pedidos...')
  const [filter, setFilter] = useState('all')

  useEffect(() => { apiFetch<Order[]>('/api/orders').then((list) => { setOrders(list); setStatus('') }).catch((error) => setStatus(error instanceof Error ? error.message : 'Não foi possível carregar os pedidos.')) }, [])

  async function updateStatus(order: Order, nextStatus: string) {
    try {
      const updated = await apiFetch<Order>(`/api/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) })
      setOrders((current) => current.map((item) => item.id === order.id ? updated : item))
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível atualizar o pedido.') }
  }

  async function removeOrder(order: Order) {
    if (!window.confirm(`Excluir o pedido de ${order.customer_name}?`)) return
    try { await apiFetch(`/api/orders/${order.id}`, { method: 'DELETE' }); setOrders((current) => current.filter((item) => item.id !== order.id)) } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível excluir o pedido.') }
  }

  const visibleOrders = filter === 'all' ? orders : orders.filter((order) => order.status === filter)
  return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">Operação</p><h1>Pedidos</h1><p>Acompanhe o andamento dos pedidos registrados.</p></div><select className="status-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todos os status</option><option value="in_preparation">Em preparo</option><option value="completed">Concluídos</option><option value="cancelled">Cancelados</option></select></header><section className="page-card"><p className="info-note">Novos pedidos devem ser criados pelo fluxo de proposta e confirmação do Copiloto.</p>{status && <p className="table-status">{status}</p>}{!status && <div className="data-table order-table"><div className="data-table-row data-table-head"><span>Cliente</span><span>Itens</span><span>Total</span><span>Status</span><span>Ações</span></div>{visibleOrders.map((order) => <div className="data-table-row" key={order.id}><span><strong>{order.customer_name}</strong><small>{new Date(order.created_at).toLocaleDateString('pt-BR')}</small></span><span>{order.items.length} item(ns)</span><span>R$ {Number(order.total_amount).toFixed(2).replace('.', ',')}</span><span><select className="inline-status" value={order.status} onChange={(event) => void updateStatus(order, event.target.value)} disabled={order.status === 'cancelled'}><option value="in_preparation">Em preparo</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></span><span className="row-actions"><button onClick={() => void removeOrder(order)}>Excluir</button></span></div>)}{visibleOrders.length === 0 && <p className="table-status">Nenhum pedido encontrado.</p>}</div>}</section></div>
}
