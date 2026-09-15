import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CircleCheck,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Users,
} from 'lucide-react'
import { getSession, type Session } from '../../services/auth.service'
import { apiFetch } from '../../services/api'

type Customer = {
  id: string
  name: string
  orders_count: number
}

type Product = {
  id: string
  name: string
  stock_quantity: string
  min_stock_quantity: string
  status: string
}

type Order = {
  id: string
  customer_name: string
  status: string
  total_amount: string
  created_at: string
}

type Quote = {
  id: string
  customer_name: string
  status: string
  valid_until: string
  total_amount: string
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      getSession(),
      apiFetch<Customer[]>('/api/customers'),
      apiFetch<Product[]>('/api/products'),
      apiFetch<Order[]>('/api/orders'),
      apiFetch<Quote[]>('/api/quotes'),
    ])
      .then(
        ([
          currentSession,
          customerList,
          productList,
          orderList,
          quoteList,
        ]) => {
          setSession(currentSession)
          setCustomers(customerList)
          setProducts(productList)
          setOrders(orderList)
          setQuotes(quoteList)
        },
      )
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar o Radar.',
        )
      })
  }, [])

  const firstName = session?.full_name.split(' ')[0] || 'gestor'

  const radar = useMemo(() => {
    const criticalProducts = products.filter((product) => {
      const stock = Number(product.stock_quantity)
      const minimumStock = Number(product.min_stock_quantity)

      return (
        product.status === 'Esgotado' ||
        product.status === 'Estoque baixo' ||
        stock <= minimumStock
      )
    })

    const inProduction = orders.filter(
      (order) => order.status === 'in_preparation',
    )

    const completedRevenue = orders
      .filter((order) => order.status === 'completed')
      .reduce(
        (total, order) => total + Number(order.total_amount),
        0,
      )

    const today = startOfToday()
    const expirationLimit = new Date(today)
    expirationLimit.setDate(expirationLimit.getDate() + 7)

    const pendingQuotes = quotes.filter(
      (quote) => quote.status === 'pending',
    )

    const expiredQuotes = pendingQuotes.filter(
      (quote) => parseDateOnly(quote.valid_until) < today,
    )

    const expiringQuotes = pendingQuotes.filter((quote) => {
      const validUntil = parseDateOnly(quote.valid_until)

      return validUntil >= today && validUntil <= expirationLimit
    })

    return {
      criticalProducts,
      inProduction,
      completedRevenue,
      expiredQuotes,
      expiringQuotes,
    }
  }, [orders, products, quotes])

  const priorities = [
    {
      active: radar.criticalProducts.length > 0,
      label: 'Estoque crítico',
      detail: `${radar.criticalProducts.length} produto(s) precisam de reposição.`,
      href: '/produtos',
      icon: AlertTriangle,
      tone: 'bg-[#fff8eb] text-[#c77716]',
    },
    {
      active: radar.inProduction.length > 0,
      label: 'Pedidos em produção',
      detail: `${radar.inProduction.length} pedido(s) aguardando preparo.`,
      href: '/pedidos',
      icon: ClipboardCheck,
      tone: 'bg-[#f2f5ff] text-signal',
    },
    {
      active: radar.expiredQuotes.length > 0,
      label: 'Orçamentos vencidos',
      detail: `${radar.expiredQuotes.length} orçamento(s) estão fora da validade.`,
      href: '/orcamentos',
      icon: FileWarning,
      tone: 'bg-[#fff1f3] text-[#d84f62]',
    },
    {
      active: radar.expiringQuotes.length > 0,
      label: 'Orçamentos vencendo',
      detail: `${radar.expiringQuotes.length} orçamento(s) vencem nos próximos 7 dias.`,
      href: '/orcamentos',
      icon: Clock3,
      tone: 'bg-[#f8f2ff] text-[#8b5cc7]',
    },
  ]

  const activePriorities = priorities.filter(
    (priority) => priority.active,
  )

  const alertLabel =
    activePriorities.length === 1
      ? '1 alerta'
      : `${activePriorities.length} alertas`

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Radar operacional</p>
          <h1>Olá, {firstName}.</h1>
          <p>Veja prioridades e indicadores reais da sua empresa.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link className="secondary-button" to="/clientes/novo">
            Cadastrar cliente
          </Link>

          <Link className="secondary-button" to="/produtos/novo">
            Cadastrar produto
          </Link>

          <Link className="primary-button" to="/copiloto">
            Abrir Copiloto
          </Link>
        </div>
      </header>

      {error && <p className="error-banner mb-5">{error}</p>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RadarCard
          icon={Users}
          label="Clientes"
          value={customers.length}
          detail="base cadastrada"
          href="/clientes"
        />

        <RadarCard
          icon={Boxes}
          label="Produtos"
          value={products.length}
          detail="itens no catálogo"
          href="/produtos"
        />

        <RadarCard
          icon={ClipboardCheck}
          label="Em produção"
          value={radar.inProduction.length}
          detail="pedidos aguardando preparo"
          href="/pedidos"
        />

        <RadarCard
          icon={FileWarning}
          label="Faturamento concluído"
          value={formatMoney(radar.completedRevenue)}
          detail="pedidos concluídos"
          href="/pedidos"
        />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <div className="page-card">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Prioridades</p>
              <h2 className="font-display text-xl font-semibold">
                O que precisa da sua atenção
              </h2>
            </div>

            <span className="shrink-0 rounded-full bg-[#f2f5ff] px-3 py-2 text-xs font-bold text-signal">
              {alertLabel}
            </span>
          </div>

          {activePriorities.length > 0 ? (
            <div className="grid gap-3">
              {activePriorities.map(
                ({
                  label,
                  detail,
                  href,
                  icon: PriorityIcon,
                  tone,
                }) => (
                  <Link
                    className="flex items-center gap-3 rounded-lg border border-line p-4 no-underline transition hover:border-[#9fb5ff]"
                    key={label}
                    to={href}
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}
                    >
                      <PriorityIcon size={19} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm text-ink">
                        {label}
                      </strong>
                      <small className="mt-1 block text-xs text-muted">
                        {detail}
                      </small>
                    </span>

                    <ArrowRight className="text-[#8991aa]" size={17} />
                  </Link>
                ),
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-[#bfe8d8] bg-[#effbf6] p-5 text-[#28745b]">
              <CircleCheck className="mt-0.5 shrink-0" size={22} />

              <div>
                <strong className="block text-sm">
                  Tudo sob controle
                </strong>
                <p className="mt-1 text-xs leading-relaxed">
                  Não há estoques críticos, pedidos aguardando preparo ou
                  orçamentos que exijam atenção imediata.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="page-card">
          <div className="mb-5">
            <p className="eyebrow">Acesso rápido</p>
            <h2 className="font-display text-xl font-semibold">
              Operação manual
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Escolha como trabalhar. O Copiloto é opcional.
            </p>
          </div>

          <div className="grid gap-2.5">
            <QuickLink href="/clientes" label="Gerenciar clientes" />
            <QuickLink href="/produtos" label="Gerenciar produtos" />
            <QuickLink href="/orcamentos" label="Criar orçamento" />
            <QuickLink href="/pedidos/novo" label="Criar pedido" />
          </div>
        </div>
      </section>
    </div>
  )
}

function RadarCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: typeof Users
  label: string
  value: number | string
  detail: string
  href: string
}) {
  return (
    <Link
      className="group rounded-[10px] border border-line bg-white p-5 no-underline shadow-[0_8px_24px_rgba(17,25,54,.04)] transition hover:-translate-y-0.5 hover:border-[#9fb5ff]"
      to={href}
    >
      <span className="mb-4 grid h-9 w-9 place-items-center rounded-lg bg-[#f2f5ff] text-signal">
        <Icon size={18} />
      </span>

      <span className="block text-xs text-muted">{label}</span>
      <strong className="mt-1 block font-display text-2xl font-semibold text-ink">
        {value}
      </strong>
      <small className="mt-1 block text-[11px] text-[#8991aa]">
        {detail}
      </small>
    </Link>
  )
}

function QuickLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      className="flex items-center justify-between rounded-lg border border-line px-3.5 py-3 text-xs font-bold text-[#354064] no-underline hover:border-[#9fb5ff] hover:text-signal"
      to={href}
    >
      {label}
      <ArrowRight size={15} />
    </Link>
  )
}