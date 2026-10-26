import { useEffect, useMemo, useState, useCallback } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import { useSession } from '../../contexts/SessionContext'
import { QuotePrintArea } from './QuotePrintArea'

type Customer = {
  id: string
  code: string
  name: string
  document: string | null
  trade_name: string | null
}

type Product = {
  id: string
  name: string
  price: string
}

type DraftItem = {
  key: string
  productId: string
  quantity: string
}

function newItem(): DraftItem {
  return {
    key: crypto.randomUUID(),
    productId: '',
    quantity: '1',
  }
}

type QuoteItem = {
  product_name: string
  quantity: string
  unit_price: string
}

type Quote = {
  id: string
  customer_name: string
  status: string
  created_at: string
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
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function normalizeCustomerSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[\s./-]/g, '')
}
export function QuotesPage() {
  const { can, session } = useSession()
  const [searchParams] = useSearchParams()
  const selectedCustomerId = searchParams.get('customer_id') ?? ''

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [reviewQuoteId, setReviewQuoteId] = useState<string | null>(null)
  const [printQuoteId, setPrintQuoteId] = useState<string | null>(null)
  const printQuote = quotes.find((quote) => quote.id === printQuoteId) ?? null
  const finishPrinting = useCallback(() => setPrintQuoteId(null), [])
  const reviewedQuote = quotes.find((quote) => quote.id === reviewQuoteId) ?? null

  const [customerId, setCustomerId] = useState(selectedCustomerId)
  const [customerSearch, setCustomerSearch] = useState('')
  const [items, setItems] = useState<DraftItem[]>([newItem()])
  const [submitting, setSubmitting] = useState(false)

  const filteredCustomers = useMemo(() => {
    const search = normalizeCustomerSearch(customerSearch)

    if (!search) {
      return customers
    }

    return customers.filter((customer) =>
      [customer.name, customer.trade_name ?? '', customer.document ?? '', customer.code].some(
        (value) => normalizeCustomerSearch(value).includes(search),
      ),
    )
  }, [customers, customerSearch])

  const selectedProductIds = useMemo(
    () => new Set(items.map((item) => item.productId).filter(Boolean)),
    [items],
  )

  const estimatedTotal = useMemo(
    () =>
      items.reduce((total, item) => {
        const product = products.find((candidate) => candidate.id === item.productId)
        return total + Number(product?.price ?? 0) * Number(item.quantity || 0)
      }, 0),
    [items, products],
  )

  function updateItem(key: string, field: 'productId' | 'quantity', value: string) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    )
  }

  function addItem() {
    setItems((current) => [...current, newItem()])
  }

  function removeItem(key: string) {
    setItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.key !== key),
    )
  }
  const [validUntil, setValidUntil] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  )
  const [status, setStatus] = useState('Carregando orçamentos...')

  useEffect(() => {
    fetchQuotes()
      .then(([quoteList, customerList, productList]) => {
        setQuotes(quoteList)
        setCustomers(customerList)
        setProducts(productList)
        setStatus('')
      })
      .catch((error) => {
        setStatus(getErrorMessage(error, 'Não foi possível carregar os dados.'))
      })
  }, [])

  async function createQuote(event: React.FormEvent) {
    event.preventDefault()

    if (submitting) return

    if (!customerId || !validUntil) {
      setStatus('Selecione o cliente e a validade do orçamento.')
      return
    }

    const invalidItem = items.some(
      (item) =>
        !item.productId ||
        !/^\d+(?:\.\d{1,3})?$/.test(item.quantity) ||
        Number(item.quantity) <= 0 ||
        Number(item.quantity) > 1_000_000,
    )

    if (invalidItem) {
      setStatus('Selecione os produtos e informe quantidades válidas, com até três casas decimais.')
      return
    }

    if (selectedProductIds.size !== items.length) {
      setStatus('Cada produto deve aparecer somente uma vez no orçamento.')
      return
    }

    try {
      setSubmitting(true)
      setStatus('')

      const created = await apiFetch<Quote>('/api/quotes', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          valid_until: validUntil,
          items: items.map((item) => ({
            product_id: item.productId,
            quantity: Number(item.quantity),
          })),
        }),
      })

      setQuotes((current) => [created, ...current])
      setReviewQuoteId(created.id)
      setCustomerId('')
      setCustomerSearch('')
      setItems([newItem()])
      setStatus('Orçamento criado. Confira os valores registrados antes de gerar o PDF.')
    } catch (error) {
      setStatus(getErrorMessage(error, 'Não foi possível criar o orçamento.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function updateQuote(quote: Quote, nextStatus: string) {
    try {
      const updated = await apiFetch<Quote>(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
        }),
      })

      setQuotes((current) => current.map((item) => (item.id === quote.id ? updated : item)))
    } catch (error) {
      setStatus(getErrorMessage(error, 'Não foi possível atualizar o orçamento.'))
    }
  }

  async function convert(quote: Quote) {
    try {
      const updated = await apiFetch<Quote>(`/api/quotes/${quote.id}/convert`, {
        method: 'POST',
      })

      setQuotes((current) => current.map((item) => (item.id === quote.id ? updated : item)))
    } catch (error) {
      setStatus(getErrorMessage(error, 'Não foi possível converter o orçamento.'))
    }
  }

  async function remove(quote: Quote) {
    const confirmed = window.confirm(`Excluir o orçamento de ${quote.customer_name}?`)

    if (!confirmed) {
      return
    }

    try {
      await apiFetch(`/api/quotes/${quote.id}`, {
        method: 'DELETE',
      })

      setQuotes((current) => current.filter((item) => item.id !== quote.id))
    } catch (error) {
      setStatus(getErrorMessage(error, 'Não foi possível excluir o orçamento.'))
    }
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Vendas</p>
          <h1>Orçamentos</h1>
          <p>Monte propostas, acompanhe aprovações e converta vendas.</p>
        </div>

        {selectedCustomerId && (
          <Link className="secondary-button" to={`/clientes/${selectedCustomerId}`}>
            <ArrowLeft size={16} />
            Voltar ao cliente
          </Link>
        )}
      </header>

      <form className="page-card quote-form" onSubmit={createQuote}>
        <h2>Novo orçamento</h2>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <div className="grid gap-3">
            <label>
              Buscar cliente
              <input
                type="search"
                placeholder="Nome, CPF/CNPJ ou código do cliente"
                value={customerSearch}
                disabled={submitting}
                autoComplete="off"
                aria-describedby="customer-search-feedback"
                onChange={(event) => {
                  setCustomerSearch(event.target.value)
                  setCustomerId('')
                }}
              />
            </label>

            <label>
              Cliente do orçamento
              <select
                required
                value={customerId}
                disabled={submitting}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">
                  {filteredCustomers.length === 0
                    ? 'Nenhum cliente encontrado'
                    : 'Selecione um cliente'}
                </option>

                {filteredCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} — {customer.name}
                    {customer.document ? ` — ${customer.document}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <p id="customer-search-feedback" className="text-sm text-muted" role="status">
              {customerSearch.trim()
                ? filteredCustomers.length === 0
                  ? 'Nenhum resultado. Confira o nome, documento ou código informado.'
                  : `${filteredCustomers.length} cliente(s) encontrado(s). Selecione o cliente desejado.`
                : 'Pesquise pelo nome, nome fantasia, CPF/CNPJ ou código e selecione um cliente.'}
            </p>
          </div>

          <label>
            Válido até
            <input
              required
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          </label>
        </div>

        <section className="mt-6 border-t border-line pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Itens da proposta</h3>
              <p className="text-sm text-muted">
                Adicione os produtos que fazem parte deste orçamento.
              </p>
            </div>

            <button className="secondary-button" onClick={addItem} type="button">
              <Plus size={16} />
              Adicionar produto
            </button>
          </div>

          <div className="grid gap-3">
            {items.map((item, index) => {
              const selectedProduct = products.find((product) => product.id === item.productId)
              const quantityValue = Number(item.quantity)
              const subtotal =
                Number(selectedProduct?.price ?? 0) *
                (Number.isFinite(quantityValue) ? quantityValue : 0)

              return (
                <div
                  className="grid items-end gap-3 rounded-lg border border-line bg-[#fbfcff] p-4 md:grid-cols-[minmax(0,1fr)_130px_130px_44px]"
                  key={item.key}
                >
                  <label>
                    Produto {index + 1}
                    <select
                      value={item.productId}
                      onChange={(event) => updateItem(item.key, 'productId', event.target.value)}
                    >
                      <option value="">Selecione um produto</option>
                      {products.map((product) => (
                        <option
                          disabled={
                            item.productId !== product.id && selectedProductIds.has(product.id)
                          }
                          key={product.id}
                          value={product.id}
                        >
                          {product.name} — {formatMoney(product.price)}
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
                      value={item.quantity}
                      onChange={(event) => updateItem(item.key, 'quantity', event.target.value)}
                    />
                  </label>

                  <div className="pb-3">
                    <span className="block text-xs text-muted">Subtotal</span>
                    <strong>{formatMoney(String(subtotal))}</strong>
                  </div>

                  <button
                    aria-label={`Remover produto ${index + 1}`}
                    className="grid h-[46px] w-[44px] place-items-center rounded-lg border border-line bg-white disabled:opacity-40"
                    disabled={items.length === 1}
                    onClick={() => removeItem(item.key)}
                    type="button"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-5 flex justify-between border-t border-line pt-4">
            <span>Prévia do total</span>
            <strong>{formatMoney(String(estimatedTotal))}</strong>
          </div>

          <p className="mt-2 text-xs text-muted">
            Prévia baseada nos preços atuais do catálogo. O valor salvo pelo servidor será usado no
            PDF.
          </p>
        </section>

        <button className="primary-button mt-5" disabled={submitting} type="submit">
          {submitting ? 'Criando...' : 'Criar orçamento'}
        </button>
      </form>

      {status && <p className="table-status">{status}</p>}
      {reviewedQuote && (
        <section className="page-card mb-6" aria-labelledby="quote-review-title">
          <div className="flex flex-wrap gap-2">
            <button
              className="primary-button"
              onClick={() => setPrintQuoteId(reviewedQuote.id)}
              type="button"
            >
              Gerar PDF
            </button>

            <button
              className="secondary-button"
              onClick={() => setReviewQuoteId(null)}
              type="button"
            >
              Fechar revisão
            </button>
          </div>

          <div className="mt-6 grid gap-4 border-y border-line py-4 md:grid-cols-2">
            <div>
              <span className="block text-xs text-muted">Cliente</span>
              <strong>{reviewedQuote.customer_name}</strong>
            </div>
            <div>
              <span className="block text-xs text-muted">Válido até</span>
              <strong>{formatDate(reviewedQuote.valid_until)}</strong>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[580px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase text-muted">
                  <th className="py-3 pr-4">Produto</th>
                  <th className="py-3 pr-4">Quantidade</th>
                  <th className="py-3 pr-4">Preço unitário</th>
                  <th className="py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {reviewedQuote.items.map((item, index) => (
                  <tr className="border-b border-line" key={`${item.product_name}-${index}`}>
                    <td className="py-3 pr-4">{item.product_name}</td>
                    <td className="py-3 pr-4">{item.quantity}</td>
                    <td className="py-3 pr-4">{formatMoney(item.unit_price)}</td>
                    <td className="py-3 text-right">
                      {formatMoney(String(Number(item.quantity) * Number(item.unit_price)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-between border-t border-line pt-4">
            <span>Total confirmado pelo sistema</span>
            <strong className="font-display text-xl">
              {formatMoney(reviewedQuote.total_amount)}
            </strong>
          </div>

          <p className="mt-3 text-xs text-muted">
            Os preços acima foram registrados no momento da criação do orçamento.
          </p>
        </section>
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
            <div className="data-table-row" key={quote.id}>
              <span>
                <strong>{quote.customer_name}</strong>

                <small>{quoteStatusLabels[quote.status] || quote.status}</small>
              </span>

              <span>
                {quote.items.map((item) => `${item.product_name} (${item.quantity})`).join(', ')}
              </span>

              <span>{formatMoney(quote.total_amount)}</span>

              <span>{formatDate(quote.valid_until)}</span>

              <span className="row-actions">
                <button type="button" onClick={() => setReviewQuoteId(quote.id)}>
                  Revisar
                </button>
                <select
                  className="inline-status"
                  disabled={quote.status === 'converted'}
                  value={quote.status}
                  onChange={(event) => void updateQuote(quote, event.target.value)}
                >
                  <option value="pending">Pendente</option>
                  <option value="approved">Aprovado</option>
                  <option value="rejected">Rejeitado</option>

                  {quote.status === 'converted' && <option value="converted">Convertido</option>}
                </select>

                {quote.status === 'approved' && !quote.converted_order_id && (
                  <button type="button" onClick={() => void convert(quote)}>
                    Converter
                  </button>
                )}

                {quote.converted_order_id && (
                  <Link to={`/pedidos?order_id=${quote.converted_order_id}`}>Ver pedido</Link>
                )}

                {can('quote:delete') && (
                  <button type="button" onClick={() => void remove(quote)}>
                    Excluir
                  </button>
                )}
              </span>
            </div>
          ))}

          {quotes.length === 0 && !status && (
            <p className="table-status">Nenhum orçamento cadastrado.</p>
          )}
          {printQuote && (
            <QuotePrintArea
              quote={printQuote}
              organization={session.organization}
              onDone={finishPrinting}
            />
          )}
        </div>
      </section>
    </div>
  )
}
