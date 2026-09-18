import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Edit3,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  UserRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch } from '../../services/api'

type OrderItem = {
  id: string
  product_id: string
  product_name: string
  quantity: string
  unit_price: string
}

type Order = {
  id: string
  status: string
  total_amount: string
  items: OrderItem[]
  created_at: string
}

type Quote = {
  id: string
  status: string
  valid_until: string
  total_amount: string
  converted_order_id: string | null
  items: OrderItem[]
  created_at: string
}

type CustomerProfile = {
  id: string
  name: string
  phone: string
  whatsapp: string | null
  email: string | null
  is_active: boolean
  person_type: 'individual' | 'company'
  document: string | null
  trade_name: string | null
  state_registration: string | null
  birth_date: string | null
  category: 'final_consumer' | 'reseller' | 'event'
  default_discount_percent: string | null
  notes: string | null
  postal_code: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  total_spent: string
  orders_count: number
  last_purchase_at: string | null
  created_at: string
  orders: Order[]
  quotes: Quote[]
}

const categoryLabels: Record<
  CustomerProfile['category'],
  string
> = {
  final_consumer: 'Consumidor final',
  reseller: 'Revendedor',
  event: 'Cliente de eventos',
}

const orderStatusLabels: Record<string, string> = {
  in_preparation: 'Em preparo',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const orderStatusClasses: Record<string, string> = {
  in_preparation:
    'border-[#f4d9a8] bg-[#fff8eb] text-[#9a6512]',
  completed:
    'border-[#bfe8d8] bg-[#effbf6] text-[#28745b]',
  cancelled:
    'border-[#f3c8d0] bg-[#fff1f3] text-[#b43d51]',
}

const quoteStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  converted: 'Convertido em pedido',
}

const quoteStatusClasses: Record<string, string> = {
  pending:
    'border-[#f4d9a8] bg-[#fff8eb] text-[#9a6512]',
  approved:
    'border-[#bfd5ff] bg-[#f1f5ff] text-[#315cc9]',
  rejected:
    'border-[#f3c8d0] bg-[#fff1f3] text-[#b43d51]',
  converted:
    'border-[#bfe8d8] bg-[#effbf6] text-[#28745b]',
}

function formatMoney(value: string): string {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(value: string | null): string {
  if (!value) return 'Não registrada'

  return new Date(value).toLocaleDateString('pt-BR')
}

function formatDateOnly(value: string): string {
  return new Date(
    `${value}T00:00:00`,
  ).toLocaleDateString('pt-BR')
}

function getCommercialSituation(
  customer: CustomerProfile,
): string {
  if (!customer.is_active) {
    return 'Cadastro inativo'
  }

  if (
    Number(customer.total_spent) <= 0 ||
    !customer.last_purchase_at
  ) {
    return 'Sem compras concluídas'
  }

  const inactivityLimit = new Date()
  inactivityLimit.setDate(
    inactivityLimit.getDate() - 60,
  )

  const lastPurchase = new Date(
    customer.last_purchase_at,
  )

  if (lastPurchase < inactivityLimit) {
    return 'Sem comprar há mais de 60 dias'
  }

  return 'Cliente ativo'
}
export function CustomerProfilePage() {
  const { customerId } = useParams<{
    customerId: string
  }>()

  const [profile, setProfile] =
    useState<CustomerProfile | null>(null)
  const [status, setStatus] = useState(
    customerId
      ? 'Carregando perfil do cliente...'
      : 'Cliente não identificado.',
  )

  useEffect(() => {
    if (!customerId) return

    apiFetch<CustomerProfile>(
      `/api/customers/${customerId}`,
    )
      .then((customer) => {
        setProfile(customer)
        setStatus('')
      })
      .catch((error) => {
        setStatus(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o perfil.',
        )
      })
  }, [customerId])

  if (status) {
    return (
      <div className="page-wrap">
        <Link
          className="secondary-button mb-5"
          to="/clientes"
        >
          <ArrowLeft size={16} />
          Voltar para clientes
        </Link>

        <p className="table-status" role="status">
          {status}
        </p>
      </div>
    )
  }

  if (!profile) return null

  const address = [
    profile.street,
    profile.number,
    profile.complement,
    profile.neighborhood,
    profile.city,
    profile.state,
    profile.postal_code,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <Link
            className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-signal no-underline"
            to="/clientes"
          >
            <ArrowLeft size={15} />
            Voltar para clientes
          </Link>

          <p className="eyebrow">
            Inteligência comercial
          </p>
          <h1>{profile.name}</h1>
          <p>
            Visão completa do relacionamento com este
            cliente.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            className="secondary-button"
            to={`/clientes/novo?id=${profile.id}`}
          >
            <Edit3 size={16} />
            Editar cliente
          </Link>

          <Link
            className="secondary-button"
            to={`/orcamentos?customer_id=${profile.id}`}
          >
            <FileText size={16} />
            Criar orçamento
          </Link>

          <Link
            className="primary-button"
            to={`/pedidos/novo?customer_id=${profile.id}`}
          >
            <ShoppingBag size={16} />
            Criar pedido
          </Link>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="page-card">
          <span className="text-xs text-muted">
            Total em compras
          </span>
          <strong className="mt-3 block font-display text-2xl text-ink">
            {formatMoney(profile.total_spent)}
          </strong>
          <small className="mt-2 block text-xs text-muted">
            Somente pedidos concluídos
          </small>
        </article>

        <article className="page-card">
          <span className="text-xs text-muted">
            Pedidos registrados
          </span>
          <strong className="mt-3 block font-display text-2xl text-ink">
            {profile.orders_count}
          </strong>
          <small className="mt-2 block text-xs text-muted">
            Em todo o relacionamento
          </small>
        </article>

        <article className="page-card">
          <span className="text-xs text-muted">
            Última compra
          </span>
          <strong className="mt-3 block font-display text-xl text-ink">
            {formatDate(profile.last_purchase_at)}
          </strong>
          <small className="mt-2 block text-xs text-muted">
            Último pedido concluído
          </small>
        </article>

        <article className="page-card">
          <span className="text-xs text-muted">
            Situação comercial
          </span>
          <strong className="mt-3 block font-display text-lg text-ink">
            {getCommercialSituation(profile)}
          </strong>
          <small className="mt-2 block text-xs text-muted">
            {categoryLabels[profile.category]}
          </small>
        </article>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-5">
          <section className="page-card">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[#edf0f6] pb-4">
              <div>
                <p className="eyebrow">
                  Histórico comercial
                </p>
                <h2 className="font-display text-xl font-semibold text-ink">
                  Pedidos do cliente
                </h2>
              </div>

              <Link
                className="text-xs font-bold text-signal no-underline"
                to={`/pedidos/novo?customer_id=${profile.id}`}
              >
                Novo pedido
              </Link>
            </div>

            <div className="grid gap-3">
              {profile.orders.map((order) => (
                <article
                  className="rounded-xl border border-line bg-[#fbfcff] p-4"
                  key={order.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="block text-sm text-ink">
                        Pedido #{order.id.slice(0, 8)}
                      </strong>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <CalendarDays size={14} />
                        {formatDate(order.created_at)}
                      </span>
                    </div>

                    <div className="text-right">
                      <strong className="block text-sm text-ink">
                        {formatMoney(order.total_amount)}
                      </strong>
                      <span
                        className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${orderStatusClasses[order.status] ||
                          'border-line bg-white text-muted'
                          }`}
                      >
                        {orderStatusLabels[order.status] ||
                          order.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 border-t border-[#edf0f6] pt-3">
                    {order.items.map((item) => (
                      <div
                        className="flex flex-wrap justify-between gap-2 text-xs"
                        key={item.id}
                      >
                        <span className="text-[#536080]">
                          {item.quantity} ×{' '}
                          {item.product_name}
                        </span>
                        <span className="font-semibold text-ink">
                          {formatMoney(item.unit_price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link
                      className="text-xs font-bold text-signal no-underline"
                      to={`/notas-fiscais?order_id=${order.id}`}
                    >
                      Consultar notas fiscais
                    </Link>
                  </div>
                </article>
              ))}

              {profile.orders.length === 0 && (
                <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
                  <ShoppingBag
                    className="mx-auto text-[#9aa6c6]"
                    size={28}
                  />
                  <strong className="mt-3 block text-sm text-ink">
                    Nenhum pedido registrado
                  </strong>
                  <p className="mt-1 text-xs text-muted">
                    Este cliente ainda não possui histórico
                    de compras.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="page-card">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[#edf0f6] pb-4">
              <div>
                <p className="eyebrow">
                  Propostas comerciais
                </p>
                <h2 className="font-display text-xl font-semibold text-ink">
                  Orçamentos do cliente
                </h2>
              </div>

              <Link
                className="text-xs font-bold text-signal no-underline"
                to={`/orcamentos?customer_id=${profile.id}`}
              >
                Novo orçamento
              </Link>
            </div>

            <div className="grid gap-3">
              {profile.quotes.map((quote) => (
                <article
                  className="rounded-xl border border-line bg-[#fbfcff] p-4"
                  key={quote.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="block text-sm text-ink">
                        Orçamento #{quote.id.slice(0, 8)}
                      </strong>

                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <CalendarDays size={14} />
                        Criado em {formatDate(quote.created_at)}
                      </span>

                      <span className="mt-1 block text-xs text-muted">
                        Válido até {formatDateOnly(quote.valid_until)}
                      </span>
                    </div>

                    <div className="text-right">
                      <strong className="block text-sm text-ink">
                        {formatMoney(quote.total_amount)}
                      </strong>

                      <span
                        className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${quoteStatusClasses[quote.status] ||
                          'border-line bg-white text-muted'
                          }`}
                      >
                        {quoteStatusLabels[quote.status] ||
                          quote.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 border-t border-[#edf0f6] pt-3">
                    {quote.items.map((item) => (
                      <div
                        className="flex flex-wrap justify-between gap-2 text-xs"
                        key={item.id}
                      >
                        <span className="text-[#536080]">
                          {item.quantity} × {item.product_name}
                        </span>

                        <span className="font-semibold text-ink">
                          {formatMoney(item.unit_price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link
                      className="text-xs font-bold text-signal no-underline"
                      to="/orcamentos"
                    >
                      Gerenciar orçamento
                    </Link>
                  </div>
                </article>
              ))}

              {profile.quotes.length === 0 && (
                <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
                  <FileText
                    className="mx-auto text-[#9aa6c6]"
                    size={28}
                  />

                  <strong className="mt-3 block text-sm text-ink">
                    Nenhum orçamento registrado
                  </strong>

                  <p className="mt-1 text-xs text-muted">
                    Este cliente ainda não possui propostas
                    comerciais.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5">
          <section className="page-card">
            <p className="eyebrow">Relacionamento</p>
            <h2 className="font-display text-lg font-semibold text-ink">
              Dados do cliente
            </h2>

            <div className="mt-5 grid gap-4">
              <div className="flex items-start gap-3">
                <UserRound
                  className="mt-0.5 text-signal"
                  size={17}
                />
                <div>
                  <small className="block text-[10px] uppercase tracking-wide text-muted">
                    Cadastro
                  </small>
                  <strong className="mt-1 block text-xs text-ink">
                    {profile.person_type === 'company'
                      ? 'Pessoa jurídica'
                      : 'Pessoa física'}
                  </strong>
                  <span className="mt-1 block text-xs text-muted">
                    {profile.document ||
                      'Documento não informado'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone
                  className="mt-0.5 text-signal"
                  size={17}
                />
                <div>
                  <small className="block text-[10px] uppercase tracking-wide text-muted">
                    Telefone
                  </small>
                  <strong className="mt-1 block text-xs text-ink">
                    {profile.phone}
                  </strong>
                  {profile.whatsapp && (
                    <span className="mt-1 block text-xs text-muted">
                      WhatsApp: {profile.whatsapp}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail
                  className="mt-0.5 text-signal"
                  size={17}
                />
                <div>
                  <small className="block text-[10px] uppercase tracking-wide text-muted">
                    E-mail
                  </small>
                  <strong className="mt-1 block break-all text-xs text-ink">
                    {profile.email || 'Não informado'}
                  </strong>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin
                  className="mt-0.5 text-signal"
                  size={17}
                />
                <div>
                  <small className="block text-[10px] uppercase tracking-wide text-muted">
                    Endereço
                  </small>
                  <strong className="mt-1 block text-xs leading-relaxed text-ink">
                    {address || 'Não informado'}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section className="page-card">
            <div className="flex items-center gap-3">
              <FileText className="text-signal" size={18} />
              <div>
                <p className="eyebrow">Observações</p>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Contexto comercial
                </h2>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-muted">
              {profile.notes ||
                'Nenhuma observação comercial registrada.'}
            </p>

            {profile.default_discount_percent && (
              <p className="mt-4 rounded-lg bg-[#f3f6ff] px-3 py-2 text-xs text-[#536080]">
                Desconto padrão:{' '}
                <strong>
                  {profile.default_discount_percent}%
                </strong>
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}