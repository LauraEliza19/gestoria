import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { apiFetch } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import { useSession } from '../../contexts/SessionContext'

import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'

type OrderItem = {
  product_name: string
  quantity: string
}

type Order = {
  id: string
  customer_id: string
  customer_name: string
  status: string
  total_amount: string
  items: OrderItem[]
  created_at: string
}

type PageState = {
  notice?: string
}

const statusLabels: Record<string, string> = {
  in_preparation: 'Em preparo',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const statusTransitions: Record<string, string[]> = {
  in_preparation: ['in_preparation', 'completed', 'cancelled'],
  completed: ['completed', 'cancelled'],
  cancelled: ['cancelled', 'in_preparation'],
}

export function OrdersPage() {
  const { can } = useSession()
  const location = useLocation()
  const pageState = location.state as PageState | null
  const [searchParams] = useSearchParams()
  const highlightedOrderId = searchParams.get('order_id')
  const fromProduction = searchParams.get('from') === 'production'

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [filter, setFilter] = useState('all')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      const list = await apiFetch<Order[]>('/api/orders')
      setOrders(list)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Não foi possível carregar os pedidos.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!highlightedOrderId || orders.length === 0) {
      return
    }

    const highlightedOrder = document.getElementById(`order-${highlightedOrderId}`)

    highlightedOrder?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [highlightedOrderId, orders])

  async function updateStatus(order: Order, nextStatus: string) {
    if (nextStatus === order.status) {
      return
    }

    setUpdatingId(order.id)
    setActionError('')
    setActionNotice('')

    try {
      const updated = await apiFetch<Order>(`/api/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })

      setOrders((current) => current.map((item) => (item.id === order.id ? updated : item)))

      setActionNotice('Status do pedido atualizado.')
    } catch (error) {
      setActionError(getErrorMessage(error, 'Não foi possível atualizar o pedido.'))
    } finally {
      setUpdatingId(null)
    }
  }

  async function removeOrder(order: Order) {
    if (!window.confirm(`Excluir o pedido de ${order.customer_name}?`)) {
      return
    }

    setDeletingId(order.id)
    setActionError('')
    setActionNotice('')

    try {
      await apiFetch(`/api/orders/${order.id}`, {
        method: 'DELETE',
      })

      setOrders((current) => current.filter((item) => item.id !== order.id))

      setActionNotice('Pedido excluído.')
    } catch (error) {
      setActionError(getErrorMessage(error, 'Não foi possível excluir o pedido.'))
    } finally {
      setDeletingId(null)
    }
  }

  const visibleOrders =
    filter === 'all' ? orders : orders.filter((order) => order.status === filter)

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operação</p>
          <h1>Pedidos</h1>
          <p>Acompanhe o andamento dos pedidos registrados.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {fromProduction && (
            <Link className="secondary-button" to="/modo-fabrica">
              Voltar à produção
            </Link>
          )}
          <select
            className="status-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Todos os status</option>
            <option value="in_preparation">Em preparo</option>
            <option value="completed">Concluídos</option>
            <option value="cancelled">Cancelados</option>
          </select>

          <Link className="primary-button" to="/pedidos/novo">
            <Plus size={16} />
            Novo pedido
          </Link>
        </div>
      </header>

      {pageState?.notice && (
        <div
          className="mb-5 rounded-lg border border-[#bfe8d8] bg-[#effbf6] px-4 py-3 text-sm text-[#28745b]"
          role="status"
          aria-live="polite"
        >
          {pageState.notice}
        </div>
      )}
      {actionError && (
        <p className="error-banner mb-5" role="alert">
          {actionError}
        </p>
      )}

      {actionNotice && (
        <p
          className="mb-5 rounded-lg border border-[#bfe8d8] bg-[#effbf6] px-4 py-3 text-sm text-[#28745b]"
          role="status"
          aria-live="polite"
        >
          {actionNotice}
        </p>
      )}

      <section className="page-card">
        <p className="info-note">
          A criação manual utiliza uma revisão protegida antes de registrar o pedido e descontar o
          estoque.
        </p>

        {loading && <LoadingState message="Carregando pedidos..." />}

        {!loading && loadError && (
          <ErrorState message={loadError} onRetry={() => void loadOrders()} />
        )}

        {!loading && !loadError && visibleOrders.length === 0 && (
          <EmptyState
            title="Nenhum pedido encontrado"
            description={
              filter === 'all'
                ? 'Crie o primeiro pedido para iniciar a operação.'
                : 'Não existem pedidos com o status selecionado.'
            }
          />
        )}

        {!loading && !loadError && visibleOrders.length > 0 && (
          <div className="data-table order-table lg:overflow-x-visible">
            <div className="data-table-row data-table-head">
              <span>Cliente</span>
              <span>Itens</span>
              <span>Total</span>
              <span>Status</span>
              <span>Ações</span>
            </div>

            {visibleOrders.map((order) => (
              <div
                className={`data-table-row ${
                  order.id === highlightedOrderId
                    ? 'scroll-mt-24 rounded-lg border-t-transparent bg-[#f7f9ff] shadow-[inset_3px_0_0_#3d63f5] lg:-mx-3 lg:px-3'
                    : ''
                }`}
                id={`order-${order.id}`}
                key={order.id}
              >
                <span>
                  <strong>{order.customer_name}</strong>
                  <small>{new Date(order.created_at).toLocaleDateString('pt-BR')}</small>
                </span>

                <span>
                  {order.items.length === 1 ? '1 item' : `${order.items.length} itens`}
                  <small>
                    {order.items
                      .map((item) => `${item.quantity}x ${item.product_name}`)
                      .join(' · ')}
                  </small>
                </span>

                <span>R$ {Number(order.total_amount).toFixed(2).replace('.', ',')}</span>

                <span>
                  <select
                    className="inline-status"
                    value={order.status}
                    disabled={updatingId === order.id || deletingId === order.id}
                    aria-label={`Status do pedido de ${order.customer_name}`}
                    onChange={(event) => void updateStatus(order, event.target.value)}
                  >
                    {(statusTransitions[order.status] ?? [order.status]).map((availableStatus) => (
                      <option key={availableStatus} value={availableStatus}>
                        {statusLabels[availableStatus] ?? availableStatus}
                      </option>
                    ))}
                  </select>
                </span>

                <span className="row-actions">
                  {order.status === 'in_preparation' && (
                    <Link to={`/modo-fabrica?order_id=${order.id}`}>Ver na produção</Link>
                  )}

                  <Link
                    to={`/notas-fiscais?order_id=${order.id}${
                      fromProduction ? '&from=production' : ''
                    }`}
                  >
                    Notas fiscais
                  </Link>

                  {can('order:delete') && (
                    <button
                      type="button"
                      disabled={deletingId === order.id || updatingId === order.id}
                      onClick={() => void removeOrder(order)}
                    >
                      {deletingId === order.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
