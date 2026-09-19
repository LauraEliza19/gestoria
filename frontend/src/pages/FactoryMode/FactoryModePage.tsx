import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChefHat, Check, Clock3, RefreshCw, Search } from 'lucide-react'
import { apiFetch } from '../../services/api'
import { ProductionPanel } from './ProductionPanel'

type Order = {
  id: string
  customer_name: string
  status: string
  items: { product_name: string; quantity: string }[]
  created_at: string
}
type Queue = 'in_preparation' | 'completed'

const quantities = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 })
const dates = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

export function FactoryModePage() {
  const [area, setArea] = useState<'orders' | 'production'>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [tab, setTab] = useState<Queue>('in_preparation')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('oldest')
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const busy = useRef(true)

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<Order[]>('/api/orders', { signal: controller.signal })
      .then((list) => {
        if (controller.signal.aborted) return
        setOrders(list)
        setLoaded(true)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os pedidos.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          busy.current = false
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

  async function refresh() {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError('')
    setNotice('')
    try {
      setOrders(await apiFetch<Order[]>('/api/orders'))
      setLoaded(true)
      setNotice('Fila atualizada.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a fila. Tente novamente.')
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  async function complete(order: Order) {
    if (busy.current) return
    busy.current = true
    setCompleting(order.id)
    setError('')
    setNotice('')
    try {
      const updated = await apiFetch<Order>(`/api/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      })
      setOrders((current) => current.map((item) => item.id === order.id ? updated : item))
      setNotice(`Pedido ${order.id.slice(0, 8)} de ${order.customer_name} concluído.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir o pedido. Tente novamente.')
    } finally {
      busy.current = false
      setCompleting(null)
    }
  }

  const pending = orders.filter((order) => order.status === 'in_preparation')
  const completed = orders.filter((order) => order.status === 'completed')
  const pendingItems = pending.reduce((total, order) => total + order.items.reduce((sum, item) => sum + Number(item.quantity), 0), 0)
  const query = normalize(search)
  const visible = (tab === 'in_preparation' ? pending : completed)
    .filter((order) => normalize(order.customer_name).includes(query) || normalize(order.id).includes(query))
    .sort((a, b) => {
      const difference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return (sort === 'oldest' ? difference : -difference) || a.id.localeCompare(b.id)
    })
  const disabled = loading || completing !== null

  return (
    <div className="page-wrap factory-page">
      <header className="page-header">
        <div>
          <p className="eyebrow !text-signal">GestorIA / Cozinha</p>
          <h1 className="flex items-center gap-3"><ChefHat size={32} aria-hidden="true" />Cozinha</h1>
          <p>Organize a fila de preparo e acompanhe cada pedido até a conclusão.</p>
        </div>
        <Link className="secondary-button" to="/dashboard">Voltar ao painel</Link>
      </header>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Áreas da cozinha">
        <button type="button" aria-pressed={area === 'orders'} className={area === 'orders' ? 'primary-button' : 'secondary-button'} onClick={() => setArea('orders')}>Fila de pedidos</button>
        <button type="button" aria-pressed={area === 'production'} className={area === 'production' ? 'primary-button' : 'secondary-button'} onClick={() => setArea('production')}>Produção e receitas</button>
      </div>
      {area === 'production' ? <ProductionPanel /> : <>
      <div className="metric-grid">
        <article><span>Em preparo</span><strong>{loaded ? pending.length : '—'}</strong><small>Pedidos aguardando conclusão</small></article>
        <article><span>Itens pendentes</span><strong>{loaded ? quantities.format(pendingItems) : '—'}</strong><small>Soma das quantidades em preparo</small></article>
        <article><span>Concluídos</span><strong>{loaded ? completed.length : '—'}</strong><small>Todos os pedidos concluídos</small></article>
      </div>

      <section className="page-card" aria-label="Fila da cozinha">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Status dos pedidos">
            {(['in_preparation', 'completed'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={tab === value}
                className={`rounded-lg px-4 py-3 text-[13px] font-bold transition-colors ${tab === value ? 'bg-signal text-white' : 'bg-paper text-muted hover:text-ink'}`}
                onClick={() => setTab(value)}>
                {value === 'in_preparation' ? 'Em preparo' : 'Concluídos'}
                {loaded && ` (${value === 'in_preparation' ? pending.length : completed.length})`}
              </button>
            ))}
          </div>
          <button type="button" className="secondary-button gap-2 disabled:cursor-wait disabled:opacity-70" disabled={disabled} onClick={() => void refresh()}>
            <RefreshCw size={16} className={loading ? 'motion-safe:animate-spin' : ''} aria-hidden="true" />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        <div className="my-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="form-label" htmlFor="kitchen-search">Buscar pedido
            <div className="relative">
              <Search size={17} className="absolute left-3 top-3.5 text-muted" aria-hidden="true" />
              <input id="kitchen-search" type="search" className="form-input pl-10" placeholder="Cliente ou número do pedido" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </label>
          <label className="form-label" htmlFor="kitchen-sort">Ordenar por criação
            <select id="kitchen-sort" className="form-input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="oldest">Mais antigos primeiro</option>
              <option value="newest">Mais recentes primeiro</option>
            </select>
          </label>
        </div>

        {error && <p role="alert" className="mb-4 rounded-lg border border-[#f3cbd2] bg-[#fff4f6] p-3 text-sm text-[#a52c42]">{error}{loaded && ' Os pedidos exibidos foram mantidos; atualize a fila para conferir.'}</p>}
        <p role="status" className="mb-4 text-sm text-muted">{loading ? (loaded ? 'Atualizando a fila...' : 'Carregando pedidos...') : notice}</p>

        {loaded && <div className="grid gap-4" aria-busy={loading}>
          <p className="text-xs text-muted">{visible.length} pedido(s) encontrado(s)</p>
          {visible.map((order) => (
            <article className="min-w-0 rounded-lg border border-line p-4 sm:p-5" key={order.id} aria-labelledby={`order-${order.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-1 font-mono text-xs text-muted">Pedido {order.id.slice(0, 8)}</p>
                  <h2 id={`order-${order.id}`} className="break-words font-display text-xl font-semibold">{order.customer_name}</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'completed' ? 'bg-[#effbf6] text-[#28745b]' : 'bg-[#eef2ff] text-signal-dark'}`}>
                  {order.status === 'completed' ? 'Concluído' : 'Em preparo'}
                </span>
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Clock3 size={14} aria-hidden="true" />
                <span>Criado em <time dateTime={order.created_at}>{dates.format(new Date(order.created_at))}</time></span>
              </p>
              <ul className="my-4 divide-y divide-line rounded-lg bg-paper px-3" aria-label="Itens do pedido">
                {order.items.map((item, index) => (
                  <li key={`${item.product_name}-${index}`} className="flex items-start gap-3 py-3 text-sm">
                    <span className="shrink-0 rounded bg-white px-2 py-0.5 font-mono font-medium text-signal-dark">{quantities.format(Number(item.quantity))}×</span>
                    <span className="min-w-0 break-words">{item.product_name}</span>
                  </li>
                ))}
              </ul>
              {order.status === 'in_preparation' && <div className="flex justify-end">
                <button type="button" className="primary-button w-full gap-2 sm:w-auto" disabled={disabled} onClick={() => void complete(order)} aria-label={`Marcar pedido ${order.id.slice(0, 8)} de ${order.customer_name} como concluído`}>
                  <Check size={17} aria-hidden="true" />{completing === order.id ? 'Concluindo...' : 'Marcar concluído'}
                </button>
              </div>}
            </article>
          ))}
          {visible.length === 0 && <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center">
            <ChefHat size={28} className="mx-auto mb-3 text-muted" aria-hidden="true" />
            <p className="font-semibold">{query ? 'Nenhum pedido corresponde à busca.' : tab === 'in_preparation' ? 'Nenhum pedido em preparo.' : 'Nenhum pedido concluído.'}</p>
            <p className="mt-2 text-sm text-muted">{query ? 'Tente outro cliente ou número de pedido.' : 'Use Atualizar para consultar os pedidos mais recentes.'}</p>
            {query && <button type="button" className="secondary-button mt-4" onClick={() => setSearch('')}>Limpar busca</button>}
          </div>}
        </div>}
      </section>
      </>}
    </div>
  )
}
