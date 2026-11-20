import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChefHat, Check, Clock3, RefreshCw, Search } from 'lucide-react'
import { apiFetch, apiFetchItems } from '../../services/api'
import { ProductionPanel } from './ProductionPanel'
import type { ProductionView } from './ProductionPanel'
import { ProductionAgenda } from './ProductionAgenda'
import { OrderSupplies, SupplyBadge } from './OrderSupplies'
import { byQueueOrder, normalizeText as normalize, planQueueSupplies } from './availability'
import { loadQueueAndSupplies } from './queueRefresh'
import {
  isOperationalOrderStatus,
  nextOperationalStatus,
  operationalActionLabel,
} from './orderWorkflow'
import type { Order, Snapshot } from './productionTypes'
import { getErrorMessage } from '../../utils/errors'
import { orderLabel } from '../../utils/formatting'

type Queue = 'active' | 'completed'

const statusLabels: Record<Order['status'], string> = {
  in_preparation: 'Confirmado',
  in_production: 'Em produção',
  ready: 'Pronto',
  completed: 'Entregue',
  cancelled: 'Cancelado',
}
const priorityLabels = { normal: 'Normal', high: 'Alta', urgent: 'Urgente' } as const

const quantities = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 })
const dates = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function FactoryModePage() {
  const [area, setArea] = useState<'agenda' | 'orders' | 'production'>('agenda')
  const [productionView, setProductionView] = useState<ProductionView>('available')
  const [orders, setOrders] = useState<Order[]>([])
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [openSupplies, setOpenSupplies] = useState<string | null>(null)
  const [tab, setTab] = useState<Queue>('active')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('oldest')
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const busy = useRef(true)

  const [searchParams, setSearchParams] = useSearchParams()
  const highlightedOrderId = searchParams.get('order_id')
  const agendaDate = searchParams.get('date')

  function changeAgendaDate(date: string) {
    const nextParams = new URLSearchParams(searchParams)

    nextParams.set('date', date)
    nextParams.delete('order_id')
    setSearchParams(nextParams, { replace: true })
  }

  useEffect(() => {
    const controller = new AbortController()

    void loadQueueAndSupplies(
      () => apiFetchItems<Order>('/api/orders', { signal: controller.signal }),
      () => apiFetch<Snapshot>('/api/production', { signal: controller.signal }),
      getErrorMessage,
    ).then((result) => {
      if (controller.signal.aborted) {
        return
      }

      if (result.orders) {
        setOrders(result.orders)
        setLoaded(true)
      }
      if (result.supplies) setSnapshot(result.supplies)
      setError(result.error)
      busy.current = false
      setLoading(false)
    })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!highlightedOrderId || orders.length === 0) {
      return
    }

    const hasHighlightedOrder = orders.some(
      (order) => order.id === highlightedOrderId && isOperationalOrderStatus(order.status),
    )

    if (!hasHighlightedOrder) {
      return
    }

    const animationFrame = window.requestAnimationFrame(() => {
      document.getElementById(`factory-order-${highlightedOrderId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [highlightedOrderId, orders])

  async function refresh() {
    if (busy.current) return

    busy.current = true
    setLoading(true)
    setError('')
    setNotice('')
    setCompletedOrder(null)
    // The notice only appears after both the queue and the supplies have settled.
    const result = await loadQueueAndSupplies(
      () => apiFetchItems<Order>('/api/orders'),
      () => apiFetch<Snapshot>('/api/production'),
      getErrorMessage,
    )
    if (result.orders) {
      setOrders(result.orders)
      setLoaded(true)
    }
    if (result.supplies) setSnapshot(result.supplies)
    const kept = [
      !result.orders && loaded && 'Os pedidos exibidos foram mantidos.',
      !result.supplies && snapshot && 'Os insumos exibidos podem estar desatualizados.',
    ]
    setError([result.error, ...kept].filter(Boolean).join(' '))
    setNotice(result.notice)
    busy.current = false
    setLoading(false)
  }

  async function updateStatus(order: Order) {
    const nextStatus = nextOperationalStatus(order.status)

    if (busy.current || !nextStatus) return

    busy.current = true
    setCompleting(order.id)
    setError('')
    setNotice('')
    setCompletedOrder(null)

    try {
      const updated = await apiFetch<Order>(`/api/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
        }),
      })

      setOrders((current) => current.map((item) => (item.id === order.id ? updated : item)))
      if (updated.status === 'completed') {
        setCompletedOrder(updated)
      } else {
        setNotice(`Pedido atualizado para ${statusLabels[updated.status].toLowerCase()}.`)
      }
    } catch (reason) {
      setError(
        `${getErrorMessage(reason, 'Não foi possível atualizar o pedido. Tente novamente.')} Os pedidos exibidos foram mantidos; atualize a fila para conferir.`,
      )
    } finally {
      busy.current = false
      setCompleting(null)
    }
  }

  const pending = orders.filter((order) => isOperationalOrderStatus(order.status))
  const completed = orders.filter((order) => order.status === 'completed')
  const pendingItems = pending.reduce(
    (total, order) => total + order.items.reduce((sum, item) => sum + Number(item.quantity), 0),
    0,
  )
  // Reservations always follow the queue (oldest first), whatever the search or sort shown.
  const supplies = useMemo(
    () => (snapshot ? planQueueSupplies(orders, snapshot) : null),
    [orders, snapshot],
  )
  const query = normalize(search)
  const visible = (tab === 'active' ? pending : completed)
    .filter(
      (order) =>
        normalize(order.customer_name).includes(query) ||
        normalize(order.id).includes(query) ||
        order.items.some((item) => normalize(item.product_name).includes(query)),
    )
    .sort((a, b) => (sort === 'oldest' ? byQueueOrder(a, b) : byQueueOrder(b, a)))
  const disabled = loading || completing !== null

  return (
    <div className="page-wrap factory-page">
      <header className="page-header">
        <div>
          <p className="eyebrow !text-signal">GestorIA / Produção</p>
          <h1 className="flex items-center gap-3">
            <ChefHat size={32} aria-hidden="true" />
            Produção
          </h1>
          <p>Organize a fila de preparo e acompanhe cada pedido até a conclusão.</p>
        </div>
        <Link className="secondary-button" to={highlightedOrderId ? '/pedidos' : '/dashboard'}>
          {highlightedOrderId ? 'Voltar aos pedidos' : 'Voltar ao painel'}
        </Link>
      </header>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Áreas de produção">
        <button
          type="button"
          aria-pressed={area === 'agenda'}
          className={area === 'agenda' ? 'primary-button' : 'secondary-button'}
          onClick={() => setArea('agenda')}
        >
          Agenda
        </button>

        <button
          type="button"
          aria-pressed={area === 'orders'}
          className={area === 'orders' ? 'primary-button' : 'secondary-button'}
          onClick={() => setArea('orders')}
        >
          Fila de pedidos
        </button>
        <button
          type="button"
          aria-pressed={area === 'production'}
          className={area === 'production' ? 'primary-button' : 'secondary-button'}
          onClick={() => {
            setProductionView('available')
            setArea('production')
          }}
        >
          Produção e receitas
        </button>
      </div>
      {area === 'agenda' ? (
        <ProductionAgenda
          key={agendaDate ?? 'today'}
          initialDate={agendaDate}
          onDateChange={changeAgendaDate}
        />
      ) : area === 'production' ? (
        <ProductionPanel initialView={productionView} onSnapshot={setSnapshot} />
      ) : (
        <>
          <div className="metric-grid">
            <article>
              <span>Pedidos ativos</span>
              <strong>{loaded ? pending.length : '—'}</strong>
              <small>Confirmados, em produção ou prontos</small>
            </article>
            <article>
              <span>Itens pendentes</span>
              <strong>{loaded ? quantities.format(pendingItems) : '—'}</strong>
              <small>Soma das quantidades ainda em operação</small>
            </article>
            <article>
              <span>Concluídos</span>
              <strong>{loaded ? completed.length : '—'}</strong>
              <small>Todos os pedidos concluídos</small>
            </article>
          </div>

          <section className="page-card" aria-label="Fila de produção">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Status dos pedidos">
                {(['active', 'completed'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={tab === value}
                    className={`rounded-lg px-4 py-3 text-[13px] font-bold transition-colors ${tab === value ? 'bg-signal text-white' : 'bg-paper text-muted hover:text-ink'}`}
                    onClick={() => setTab(value)}
                  >
                    {value === 'active' ? 'Pedidos ativos' : 'Entregues'}
                    {loaded && ` (${value === 'active' ? pending.length : completed.length})`}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="secondary-button gap-2 disabled:cursor-wait disabled:opacity-70"
                disabled={disabled}
                onClick={() => void refresh()}
              >
                <RefreshCw
                  size={16}
                  className={loading ? 'motion-safe:animate-spin' : ''}
                  aria-hidden="true"
                />
                {loading ? 'Atualizando...' : 'Atualizar'}
              </button>
            </div>

            <div className="my-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="form-label" htmlFor="kitchen-search">
                Buscar pedido
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-3.5 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="kitchen-search"
                    type="search"
                    className="form-input pl-10"
                    placeholder="Cliente, número do pedido ou produto"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </label>
              <label className="form-label" htmlFor="kitchen-sort">
                Ordenar por criação
                <select
                  id="kitchen-sort"
                  className="form-input"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="oldest">Mais antigos primeiro</option>
                  <option value="newest">Mais recentes primeiro</option>
                </select>
              </label>
            </div>
            {error && (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f3cbd2] bg-[#fff4f6] p-3 text-sm text-[#a52c42]"
              >
                <p>{error}</p>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={disabled}
                  onClick={() => void refresh()}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {(loading || notice) && (
              <p role="status" className="mb-4 text-sm text-muted">
                {loading
                  ? loaded
                    ? 'Atualizando a fila e os insumos...'
                    : 'Carregando pedidos e insumos...'
                  : notice}
              </p>
            )}

            {completedOrder && (
              <section
                aria-labelledby="completed-order-title"
                className="mb-4 flex flex-col gap-4 rounded-lg border border-[#b9e7d5] bg-[#effbf6] p-4 sm:flex-row sm:items-center sm:justify-between"
                role="status"
              >
                <div>
                  <p className="font-semibold text-[#28745b]" id="completed-order-title">
                    Pedido {orderLabel(completedOrder)} de {completedOrder.customer_name} concluído.
                  </p>
                  <p className="mt-1 text-sm text-[#4f7769]">
                    A produção foi finalizada. Registre os ingredientes usados para manter o estoque
                    correto, consulte o pedido ou siga para os documentos fiscais.
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="secondary-button w-full sm:w-auto"
                    onClick={() => {
                      setProductionView('ingredients')
                      setArea('production')
                    }}
                  >
                    Registrar uso no estoque
                  </button>

                  <Link
                    className="secondary-button w-full sm:w-auto"
                    to={`/pedidos?order_id=${completedOrder.id}&from=production`}
                  >
                    Ver pedido concluído
                  </Link>

                  <Link
                    className="primary-button w-full sm:w-auto"
                    to={`/notas-fiscais?order_id=${completedOrder.id}&from=production`}
                  >
                    Consultar nota fiscal
                  </Link>
                </div>
              </section>
            )}
            {loaded && (
              <div className="grid gap-4" aria-busy={loading}>
                <p className="text-xs text-muted">
                  {visible.length}{' '}
                  {visible.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
                </p>
                {visible.map((order) => {
                  const reservesSupplies = ['in_preparation', 'in_production'].includes(
                    order.status,
                  )
                  const plan = reservesSupplies ? supplies?.get(order.id) : undefined
                  return (
                    <article
                      aria-labelledby={`order-${order.id}`}
                      className={`min-w-0 scroll-mt-24 rounded-lg border p-4 transition sm:p-5 ${
                        order.id === highlightedOrderId
                          ? 'border-[#9fb5ff] bg-[#f7f9ff] shadow-[inset_3px_0_0_#3d63f5]'
                          : 'border-line'
                      }`}
                      id={`factory-order-${order.id}`}
                      key={order.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="mb-1 font-mono text-xs text-muted">
                            Pedido {orderLabel(order)}
                          </p>
                          <h2
                            id={`order-${order.id}`}
                            className="break-words font-display text-xl font-semibold"
                          >
                            {order.customer_name}
                          </h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {reservesSupplies &&
                            (plan ? (
                              <SupplyBadge status={plan.status} />
                            ) : (
                              <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-muted">
                                Insumos não carregados
                              </span>
                            ))}
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'completed' ? 'bg-[#effbf6] text-[#28745b]' : order.status === 'ready' ? 'bg-[#fff8df] text-[#8a6500]' : 'bg-[#eef2ff] text-signal-dark'}`}
                          >
                            {statusLabels[order.status]}
                          </span>
                          {order.priority && order.priority !== 'normal' && (
                            <span className="rounded-full bg-[#fff0f3] px-3 py-1 text-xs font-semibold text-[#a52c42]">
                              Prioridade {priorityLabels[order.priority].toLowerCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                        <Clock3 size={14} aria-hidden="true" />
                        <span>
                          Criado em{' '}
                          <time dateTime={order.created_at}>
                            {dates.format(new Date(order.created_at))}
                          </time>
                        </span>
                      </p>
                      {order.promised_at && (
                        <p className="mt-2 text-sm font-semibold text-ink">
                          Entrega combinada:{' '}
                          <time dateTime={order.promised_at}>
                            {dates.format(new Date(order.promised_at))}
                          </time>
                        </p>
                      )}
                      {order.notes && <p className="mt-2 text-sm text-muted">{order.notes}</p>}
                      <ul
                        className="my-4 divide-y divide-line rounded-lg bg-paper px-3"
                        aria-label="Itens do pedido"
                      >
                        {order.items.map((item, index) => (
                          <li
                            key={`${item.product_name}-${index}`}
                            className="flex items-start gap-3 py-3 text-sm"
                          >
                            <span className="shrink-0 rounded bg-white px-2 py-0.5 font-mono font-medium text-signal-dark">
                              {quantities.format(Number(item.quantity))}×
                            </span>
                            <span className="min-w-0 break-words">{item.product_name}</span>
                          </li>
                        ))}
                      </ul>
                      {openSupplies === order.id && plan && (
                        <OrderSupplies id={`supplies-${order.id}`} plan={plan} />
                      )}
                      <div className="flex flex-wrap justify-end gap-3">
                        {reservesSupplies && (
                          <button
                            type="button"
                            className="secondary-button w-full sm:w-auto"
                            disabled={!plan}
                            aria-expanded={openSupplies === order.id}
                            aria-controls={`supplies-${order.id}`}
                            onClick={() =>
                              setOpenSupplies((current) => (current === order.id ? null : order.id))
                            }
                          >
                            {openSupplies === order.id ? 'Ocultar insumos' : 'Consultar insumos'}
                          </button>
                        )}

                        <Link
                          className="secondary-button w-full sm:w-auto"
                          to={`/pedidos?order_id=${order.id}&from=production`}
                        >
                          Ver pedido
                        </Link>

                        {isOperationalOrderStatus(order.status) && (
                          <button
                            type="button"
                            className="primary-button w-full gap-2 sm:w-auto"
                            disabled={disabled}
                            onClick={() => void updateStatus(order)}
                            aria-label={`Avançar pedido ${orderLabel(order)} de ${order.customer_name} para a próxima etapa`}
                          >
                            <Check size={17} aria-hidden="true" />
                            {completing === order.id
                              ? 'Atualizando...'
                              : operationalActionLabel(order.status)}
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
                {visible.length === 0 && (
                  <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center">
                    <ChefHat size={28} className="mx-auto mb-3 text-muted" aria-hidden="true" />
                    <p className="font-semibold">
                      {query
                        ? 'Nenhum pedido corresponde à busca.'
                        : tab === 'active'
                          ? 'Nenhum pedido ativo.'
                          : 'Nenhum pedido entregue.'}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      {query
                        ? 'Tente outro cliente, número de pedido ou produto.'
                        : 'Use Atualizar para consultar os pedidos mais recentes.'}
                    </p>
                    {query && (
                      <button
                        type="button"
                        className="secondary-button mt-4"
                        onClick={() => setSearch('')}
                      >
                        Limpar busca
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
