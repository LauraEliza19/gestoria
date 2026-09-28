import { useEffect, useState } from 'react'
import {
  Link,
  useSearchParams,
} from 'react-router-dom'
import { apiFetch } from '../../services/api'

type CustomerCategory =
  | 'final_consumer'
  | 'reseller'
  | 'event'

type CustomerOpportunity =
  | 'without-purchases'
  | 'dormant'

type Customer = {
  id: string
  name: string
  phone: string
  email?: string | null
  category: CustomerCategory
  total_spent: string
  last_purchase_at: string | null
  is_active: boolean
}

const categoryLabels: Record<CustomerCategory, string> = {
  final_consumer: 'Consumidor final',
  reseller: 'Revendedor',
  event: 'Cliente de eventos',
}

const opportunityLabels: Record<
  CustomerOpportunity,
  string
> = {
  'without-purchases': 'Sem compras concluídas',
  dormant: 'Sem comprar há mais de 60 dias',
}

function isCustomerCategory(
  value: string | null,
): value is CustomerCategory {
  return (
    value !== null &&
    Object.prototype.hasOwnProperty.call(
      categoryLabels,
      value,
    )
  )
}

function isCustomerOpportunity(
  value: string | null,
): value is CustomerOpportunity {
  return (
    value !== null &&
    Object.prototype.hasOwnProperty.call(
      opportunityLabels,
      value,
    )
  )
}

function getCategoryLabel(category?: string) {
  if (!category) {
    return categoryLabels.final_consumer
  }

  return (
    categoryLabels[category as CustomerCategory] ||
    'Categoria não identificada'
  )
}

export function CustomersPage() {
  const [searchParams, setSearchParams] =
    useSearchParams()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(
    'Carregando clientes...',
  )

  const categoryParameter = searchParams.get('category')
  const opportunityParameter =
    searchParams.get('opportunity')

  const categoryFilter = isCustomerCategory(
    categoryParameter,
  )
    ? categoryParameter
    : null

  const opportunityFilter = isCustomerOpportunity(
    opportunityParameter,
  )
    ? opportunityParameter
    : null

  useEffect(() => {
    apiFetch<Customer[]>('/api/customers')
      .then((list) => {
        setCustomers(list)
        setStatus('')
      })
      .catch((error) => {
        setStatus(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os clientes.',
        )
      })
  }, [])

  async function removeCustomer(customer: Customer) {
    const confirmed = window.confirm(
      `Excluir o cliente "${customer.name}"?`,
    )

    if (!confirmed) return

    try {
      await apiFetch(`/api/customers/${customer.id}`, {
        method: 'DELETE',
      })

      setCustomers((current) =>
        current.filter((item) => item.id !== customer.id),
      )
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir o cliente.',
      )
    }
  }

  function clearFilters() {
    setSearchParams({})
  }

  const inactivityLimit = new Date()
  inactivityLimit.setDate(inactivityLimit.getDate() - 60)

  const normalizedSearch = search.trim().toLowerCase()

  const filteredCustomers = customers.filter((customer) => {
    if (
      categoryFilter &&
      (!customer.is_active ||
        customer.category !== categoryFilter)
    ) {
      return false
    }

    if (opportunityFilter === 'without-purchases') {
      if (
        !customer.is_active ||
        Number(customer.total_spent) > 0
      ) {
        return false
      }
    }

    if (opportunityFilter === 'dormant') {
      if (
        !customer.is_active ||
        !customer.last_purchase_at
      ) {
        return false
      }

      const lastPurchase = new Date(
        customer.last_purchase_at,
      )

      if (
        Number.isNaN(lastPurchase.getTime()) ||
        lastPurchase >= inactivityLimit
      ) {
        return false
      }
    }

    const searchableContent = [
      customer.name,
      customer.phone,
      customer.email || '',
      getCategoryLabel(customer.category),
    ]
      .join(' ')
      .toLowerCase()

    return searchableContent.includes(normalizedSearch)
  })

  const activeFilterLabel = categoryFilter
    ? `Segmento: ${categoryLabels[categoryFilter]}`
    : opportunityFilter
      ? `Oportunidade: ${opportunityLabels[opportunityFilter]}`
      : ''

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Relacionamento</p>
          <h1>Clientes</h1>
          <p>
            Consulte e mantenha sua base de clientes atualizada.
          </p>
        </div>

        <Link className="primary-button" to="/clientes/novo">
          Novo cliente
        </Link>
      </header>

      <section className="page-card">
        <input
          className="search-input"
          placeholder="Buscar por nome, telefone, e-mail ou categoria"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {activeFilterLabel && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dce4ff] bg-[#f7f9ff] px-4 py-3">
            <div>
              <small className="block text-[10px] font-bold uppercase tracking-wide text-muted">
                Filtro aplicado pelo Radar
              </small>
              <strong className="mt-1 block text-sm text-ink">
                {activeFilterLabel}
              </strong>
            </div>

            <button
              className="text-xs font-bold text-signal"
              type="button"
              onClick={clearFilters}
            >
              Limpar filtro
            </button>
          </div>
        )}

        {status && (
          <p className="table-status" role="status">
            {status}
          </p>
        )}

        {!status && (
          <>
            <p className="mt-4 text-xs text-muted">
              {filteredCustomers.length}{' '}
              {filteredCustomers.length === 1
                ? 'cliente encontrado'
                : 'clientes encontrados'}
            </p>

            <div className="data-table">
              <div className="data-table-row data-table-head">
                <span>Nome</span>
                <span>Telefone</span>
                <span>E-mail</span>
                <span>Ações</span>
              </div>

              {filteredCustomers.map((customer) => (
                <div
                  className="data-table-row"
                  key={customer.id}
                >
                  <span>
                    <strong>{customer.name}</strong>
                    <small>
                      {getCategoryLabel(customer.category)}
                    </small>
                  </span>

                  <span>{customer.phone}</span>

                  <span>
                    {customer.email || 'Não informado'}
                  </span>

                  <span className="row-actions">
                    <Link to={`/clientes/${customer.id}`}>
                      Ver perfil
                    </Link>

                    <Link
                      to={`/clientes/novo?id=${customer.id}`}
                    >
                      Editar
                    </Link>

                    <button
                      onClick={() =>
                        void removeCustomer(customer)
                      }
                    >
                      Excluir
                    </button>
                  </span>
                </div>
              ))}

              {filteredCustomers.length === 0 && (
                <p className="table-status">
                  Nenhum cliente corresponde aos filtros.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}