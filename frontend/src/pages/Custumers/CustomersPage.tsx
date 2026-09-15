import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../services/api'

type CustomerCategory =
  | 'final_consumer'
  | 'reseller'
  | 'event'

type Customer = {
  id: string
  name: string
  phone: string
  email?: string | null
  category?: CustomerCategory | string
}

const categoryLabels: Record<CustomerCategory, string> = {
  final_consumer: 'Consumidor final',
  reseller: 'Revendedor',
  event: 'Cliente de eventos',
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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(
    'Carregando clientes...',
  )

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

  const normalizedSearch = search.trim().toLowerCase()

  const filteredCustomers = customers.filter((customer) => {
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

        {status && (
          <p className="table-status" role="status">
            {status}
          </p>
        )}

        {!status && (
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
                Nenhum cliente encontrado.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}