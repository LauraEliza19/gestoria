import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Check, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { apiFetch } from '../../services/api'
import type { PaginatedResponse } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import {
  isOperationalOrderStatus,
  nextOperationalStatus,
  operationalActionLabel,
} from './orderWorkflow'
import type { Order } from './productionTypes'

const statusLabels: Record<Order['status'], string> = {
  in_preparation: 'Confirmado',
  in_production: 'Em produção',
  ready: 'Pronto',
  completed: 'Entregue',
  cancelled: 'Cancelado',
}

const statusStyles: Record<Order['status'], string> = {
  in_preparation: 'border-[#cbdcf8] bg-[#f2f7ff] text-[#245aa5]',
  in_production: 'border-[#f2d69b] bg-[#fff8e8] text-[#8a5a00]',
  ready: 'border-[#a9dfc0] bg-[#effbf4] text-[#157347]',
  completed: 'border-line bg-paper text-muted',
  cancelled: 'border-[#f3cbd2] bg-[#fff4f6] text-[#a52c42]',
}

const priorityLabels = {
  normal: 'Prioridade normal',
  high: 'Prioridade alta',
  urgent: 'Prioridade urgente',
} as const

const priorityStyles = {
  normal: 'text-muted',
  high: 'text-[#9a6400]',
  urgent: 'font-bold text-[#b4233c]',
} as const

const agendaTime = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

const quantities = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 6,
})

const agendaPageSize = 20

type ProductionAgendaProps = {
  initialDate?: string | null
  onDateChange?: (date: string) => void
}

function isDateInputValue(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

function dateAsInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function todayAsInputValue() {
  return dateAsInputValue(new Date())
}

function moveInputDate(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00`)

  date.setDate(date.getDate() + amount)

  return dateAsInputValue(date)
}

function getDayRange(date: string) {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(start)

  end.setDate(end.getDate() + 1)

  return {
    promisedFrom: start.toISOString(),
    promisedTo: end.toISOString(),
  }
}

export function ProductionAgenda({ initialDate, onDateChange }: ProductionAgendaProps) {
  const [selectedDate, setSelectedDate] = useState(() =>
    isDateInputValue(initialDate) ? initialDate : todayAsInputValue(),
  )
  const [page, setPage] = useState(1)
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  function changeSelectedDate(value: string) {
    if (value === selectedDate) {
      return
    }

    setLoading(true)
    setError('')
    setActionError('')
    setNotice('')
    setPage(1)
    onDateChange?.(value)
    setSelectedDate(value)
  }

  function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage === page) {
      return
    }

    setLoading(true)
    setError('')
    setActionError('')
    setNotice('')
    setPage(nextPage)
  }

  async function updateStatus(order: Order) {
    const nextStatus = nextOperationalStatus(order.status)

    if (!nextStatus || updatingId !== null) {
      return
    }

    setUpdatingId(order.id)
    setActionError('')
    setNotice('')

    try {
      const updated = await apiFetch<Order>(`/api/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
        }),
      })

      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setNotice(`Pedido atualizado para ${statusLabels[updated.status].toLowerCase()}.`)
    } catch (reason) {
      setActionError(
        `${getErrorMessage(reason, 'Não foi possível atualizar o pedido.')} O pedido exibido foi mantido.`,
      )
    } finally {
      setUpdatingId(null)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const { promisedFrom, promisedTo } = getDayRange(selectedDate)
    const params = new URLSearchParams({
      promised_from: promisedFrom,
      promised_to: promisedTo,
      sort: 'promised_at',
      page: String(page),
      page_size: String(agendaPageSize),
    })

    void apiFetch<PaginatedResponse<Order>>(`/api/orders?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((response) => {
        setOrders(response.items)
        setTotal(response.total)
        setHasNext(response.has_next)
      })
      .catch((reason) => {
        if (controller.signal.aborted) {
          return
        }

        setError(getErrorMessage(reason, 'Não foi possível carregar a agenda deste dia.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [page, selectedDate])

  const summary = useMemo(
    () => ({
      confirmed: orders.filter((order) => order.status === 'in_preparation').length,
      producing: orders.filter((order) => order.status === 'in_production').length,
      ready: orders.filter((order) => order.status === 'ready').length,
    }),
    [orders],
  )

  const totalPages = Math.max(1, Math.ceil(total / agendaPageSize))

  return (
    <section className="space-y-5" aria-label="Agenda operacional">
      <div className="page-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow !text-signal">Agenda operacional</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-ink">
              <CalendarDays size={22} aria-hidden="true" />
              Entregas do dia
            </h2>
            <p className="mt-2 text-sm text-muted">
              Consulte os pedidos pela data e horário prometidos ao cliente.
            </p>
          </div>

          <div
            className="flex flex-wrap items-end gap-2"
            role="group"
            aria-label="Navegação da agenda"
          >
            <button
              type="button"
              className="secondary-button !px-3"
              aria-label="Mostrar dia anterior"
              onClick={() => changeSelectedDate(moveInputDate(selectedDate, -1))}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>

            <label className="form-label min-w-52" htmlFor="production-agenda-date">
              Data da agenda
              <input
                id="production-agenda-date"
                type="date"
                className="form-input"
                value={selectedDate}
                onChange={(event) => changeSelectedDate(event.target.value)}
              />
            </label>

            <button
              type="button"
              className="secondary-button"
              disabled={selectedDate === todayAsInputValue()}
              onClick={() => changeSelectedDate(todayAsInputValue())}
            >
              Hoje
            </button>

            <button
              type="button"
              className="secondary-button !px-3"
              aria-label="Mostrar próximo dia"
              onClick={() => changeSelectedDate(moveInputDate(selectedDate, 1))}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[#f3cbd2] bg-[#fff4f6] p-4 text-sm text-[#a52c42]"
        >
          {error}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-[#f3cbd2] bg-[#fff4f6] p-4 text-sm text-[#a52c42]"
        >
          {actionError}
        </div>
      )}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-[#bfe8d8] bg-[#effbf6] p-4 text-sm text-[#28745b]"
        >
          {notice}
        </div>
      )}

      <div className="metric-grid md:!grid-cols-2 xl:!grid-cols-4" aria-busy={loading}>
        <article>
          <span>Entregas programadas</span>
          <strong>{loading ? '—' : total}</strong>
          <small>Total do período selecionado</small>
        </article>

        <article>
          <span>Confirmados</span>
          <strong>{loading ? '—' : summary.confirmed}</strong>
          <small>Nesta página da agenda</small>
        </article>

        <article>
          <span>Em andamento</span>
          <strong>{loading ? '—' : summary.producing}</strong>
          <small>Nesta página da agenda</small>
        </article>

        <article>
          <span>Prontos</span>
          <strong>{loading ? '—' : summary.ready}</strong>
          <small>Nesta página da agenda</small>
        </article>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
          <RefreshCw size={17} className="motion-safe:animate-spin" aria-hidden="true" />
          Carregando agenda...
        </div>
      )}

      {!loading && !error && (
        <div className="page-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h3 className="text-lg font-bold text-ink">Programação de entregas</h3>
              <p className="mt-1 text-sm text-muted">
                Pedidos organizados pelo horário prometido ao cliente.
              </p>
            </div>

            <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold text-muted">
              {total} {total === 1 ? 'entrega' : 'entregas'}
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarDays size={32} className="mx-auto text-muted" aria-hidden="true" />
              <h4 className="mt-3 font-bold text-ink">Nenhuma entrega programada</h4>
              <p className="mt-1 text-sm text-muted">
                Não existem pedidos com entrega prevista para esta data.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-line" aria-label="Entregas programadas">
              {orders.map((order) => {
                const priority = order.priority ?? 'normal'

                return (
                  <li
                    key={order.id}
                    className="grid gap-4 py-5 lg:grid-cols-[90px_minmax(0,1fr)_auto] lg:items-start"
                  >
                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wide text-muted">
                        Horário
                      </span>
                      <strong className="mt-1 block text-xl text-ink">
                        {order.promised_at
                          ? agendaTime.format(new Date(order.promised_at))
                          : 'Não definido'}
                      </strong>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-ink">{order.customer_name}</h4>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[order.status]}`}
                        >
                          {statusLabels[order.status]}
                        </span>

                        <span className={`text-xs ${priorityStyles[priority]}`}>
                          {priorityLabels[priority]}
                        </span>
                      </div>

                      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        {order.items.map((item) => (
                          <li key={`${order.id}-${item.product_id}`}>
                            {quantities.format(Number(item.quantity))} × {item.product_name}
                          </li>
                        ))}
                      </ul>

                      {order.notes && (
                        <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm text-muted">
                          <strong className="text-ink">Observação:</strong> {order.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Link
                        className="secondary-button justify-center whitespace-nowrap"
                        to={`/pedidos?order_id=${order.id}&from=production&agenda_date=${selectedDate}`}
                      >
                        Ver pedido
                      </Link>

                      {isOperationalOrderStatus(order.status) && (
                        <button
                          type="button"
                          className="primary-button justify-center gap-2 whitespace-nowrap"
                          disabled={updatingId !== null}
                          aria-label={`${operationalActionLabel(order.status)} para o pedido de ${order.customer_name}`}
                          onClick={() => void updateStatus(order)}
                        >
                          <Check size={17} aria-hidden="true" />
                          {updatingId === order.id
                            ? 'Atualizando...'
                            : operationalActionLabel(order.status)}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {totalPages > 1 && (
            <nav
              className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
              aria-label="Paginação da agenda"
            >
              <span className="text-sm text-muted">
                Página <strong className="text-ink">{page}</strong> de{' '}
                <strong className="text-ink">{totalPages}</strong>
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={page === 1}
                  onClick={() => changePage(page - 1)}
                >
                  Anterior
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={!hasNext}
                  onClick={() => changePage(page + 1)}
                >
                  Próxima
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </section>
  )
}
