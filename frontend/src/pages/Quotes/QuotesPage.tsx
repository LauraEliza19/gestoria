import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../services/api'

type Customer = {
  id: string
  name: string
}

type Product = {
  id: string
  name: string
  price: string
}

type QuoteItem = {
  product_name: string
  quantity: string
}

type Quote = {
  id: string
  customer_name: string
  status: string
  valid_until: string
  total_amount: string
  converted_order_id?: string | null
  items: QuoteItem[]
}

const quoteStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  converted: 'Convertido',
}

async function fetchQuotes() {
  return Promise.all([
    apiFetch<Quote[]>('/api/quotes'),
    apiFetch<Customer[]>('/api/customers'),
    apiFetch<Product[]>('/api/products'),
  ])
}

function formatMoney(value: string): string {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(
    'pt-BR',
  )
}

export function QuotesPage() {
  const [searchParams] = useSearchParams()
  const selectedCustomerId =
    searchParams.get('customer_id') ?? ''

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [customerId, setCustomerId] = useState(
    selectedCustomerId,
  )
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [validUntil, setValidUntil] = useState(() =>
    new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .slice(0, 10),
  )
  const [status, setStatus] = useState(
    'Carregando orçamentos...',
  )

  async function load() {
    try {
      const [quoteList, customerList, productList] =
        await fetchQuotes()

      setQuotes(quoteList)
      setCustomers(customerList)
      setProducts(productList)
      setStatus('')
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os dados.',
      )
    }
  }

  useEffect(() => {
    fetchQuotes()
      .then(([quoteList, customerList, productList]) => {
        setQuotes(quoteList)
        setCustomers(customerList)
        setProducts(productList)
        setStatus('')
      })
      .catch((error) => {
        setStatus(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os dados.',
        )
      })
  }, [])

  async function createQuote(event: React.FormEvent) {
    event.preventDefault()

    if (
      !customerId ||
      !productId ||
      Number(quantity) <= 0
    ) {
      setStatus(
        'Selecione cliente, produto e quantidade válidos.',
      )
      return
    }

    try {
      await apiFetch('/api/quotes', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          valid_until: validUntil,
          items: [
            {
              product_id: productId,
              quantity: Number(quantity),
            },
          ],
        }),
      })

      setCustomerId('')
      setProductId('')
      setQuantity('1')

      await load()
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o orçamento.',
      )
    }
  }

  async function updateQuote(
    quote: Quote,
    nextStatus: string,
  ) {
    try {
      const updated = await apiFetch<Quote>(
        `/api/quotes/${quote.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      )

      setQuotes((current) =>
        current.map((item) =>
          item.id === quote.id ? updated : item,
        ),
      )
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o orçamento.',
      )
    }
  }

  async function convert(quote: Quote) {
    try {
      const updated = await apiFetch<Quote>(
        `/api/quotes/${quote.id}/convert`,
        {
          method: 'POST',
        },
      )

      setQuotes((current) =>
        current.map((item) =>
          item.id === quote.id ? updated : item,
        ),
      )
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível converter o orçamento.',
      )
    }
  }

  async function remove(quote: Quote) {
    const confirmed = window.confirm(
      `Excluir o orçamento de ${quote.customer_name}?`,
    )

    if (!confirmed) {
      return
    }

    try {
      await apiFetch(`/api/quotes/${quote.id}`, {
        method: 'DELETE',
      })

      setQuotes((current) =>
        current.filter((item) => item.id !== quote.id),
      )
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir o orçamento.',
      )
    }
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Vendas</p>
          <h1>Orçamentos</h1>
          <p>
            Monte propostas, acompanhe aprovações e converta
            vendas.
          </p>
        </div>
      </header>

      <form
        className="page-card quote-form"
        onSubmit={createQuote}
      >
        <h2>Novo orçamento</h2>

        <div className="quote-form-grid">
          <label>
            Cliente

            <select
              value={customerId}
              onChange={(event) =>
                setCustomerId(event.target.value)
              }
            >
              <option value="">Selecione</option>

              {customers.map((customer) => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Produto

            <select
              value={productId}
              onChange={(event) =>
                setProductId(event.target.value)
              }
            >
              <option value="">Selecione</option>

              {products.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.name} - {formatMoney(product.price)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Quantidade

            <input
              min="0.001"
              step="0.001"
              type="number"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
            />
          </label>

          <label>
            Válido até

            <input
              type="date"
              value={validUntil}
              onChange={(event) =>
                setValidUntil(event.target.value)
              }
            />
          </label>
        </div>

        <button className="primary-button" type="submit">
          Criar orçamento
        </button>
      </form>

      {status && (
        <p className="table-status">{status}</p>
      )}

      <section className="page-card">
        <div className="data-table quote-table">
          <div className="data-table-row data-table-head">
            <span>Cliente</span>
            <span>Itens</span>
            <span>Total</span>
            <span>Validade</span>
            <span>Ações</span>
          </div>

          {quotes.map((quote) => (
            <div
              className="data-table-row"
              key={quote.id}
            >
              <span>
                <strong>{quote.customer_name}</strong>

                <small>
                  {quoteStatusLabels[quote.status] ||
                    quote.status}
                </small>
              </span>

              <span>
                {quote.items
                  .map(
                    (item) =>
                      `${item.product_name} (${item.quantity})`,
                  )
                  .join(', ')}
              </span>

              <span>
                {formatMoney(quote.total_amount)}
              </span>

              <span>{formatDate(quote.valid_until)}</span>

              <span className="row-actions">
                <select
                  className="inline-status"
                  disabled={quote.status === 'converted'}
                  value={quote.status}
                  onChange={(event) =>
                    void updateQuote(
                      quote,
                      event.target.value,
                    )
                  }
                >
                  <option value="pending">Pendente</option>
                  <option value="approved">Aprovado</option>
                  <option value="rejected">Rejeitado</option>

                  {quote.status === 'converted' && (
                    <option value="converted">
                      Convertido
                    </option>
                  )}
                </select>

                {quote.status === 'approved' &&
                  !quote.converted_order_id && (
                    <button
                      type="button"
                      onClick={() => void convert(quote)}
                    >
                      Converter
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() => void remove(quote)}
                >
                  Excluir
                </button>
              </span>
            </div>
          ))}

          {quotes.length === 0 && !status && (
            <p className="table-status">
              Nenhum orçamento cadastrado.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}