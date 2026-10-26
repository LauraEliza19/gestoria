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
  person_type: 'individual' | 'company'
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

type CustomerSearchField = 'name' | 'code' | 'cpf' | 'cnpj'

const customerSearchConfig: Record<
  CustomerSearchField,
  {
    label: string
    placeholder: string
    hint: string
    inputMode: 'search' | 'numeric'
  }
> = {
  name: {
    label: 'Nome',
    placeholder: 'Digite o nome ou nome fantasia',
    hint: 'Pesquise pelo nome ou nome fantasia do cliente.',
    inputMode: 'search',
  },
  code: {
    label: 'Código',
    placeholder: 'Ex.: CLI-000001',
    hint: 'Pesquise pelo código automático do cliente.',
    inputMode: 'search',
  },
  cpf: {
    label: 'CPF',
    placeholder: 'Digite o CPF com ou sem pontuação',
    hint: 'A pesquisa mostrará somente clientes pessoa física.',
    inputMode: 'numeric',
  },
  cnpj: {
    label: 'CNPJ',
    placeholder: 'Digite o CNPJ com ou sem pontuação',
    hint: 'A pesquisa mostrará somente clientes pessoa jurídica.',
    inputMode: 'numeric',
  },
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
  const [customerSearchField, setCustomerSearchField] = useState<CustomerSearchField>('name')
  const [items, setItems] = useState<DraftItem[]>([newItem()])
  const [submitting, setSubmitting] = useState(false)

  const activeCustomerSearch = customerSearchConfig[customerSearchField]
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null

  const filteredCustomers = useMemo(() => {
    const search = normalizeCustomerSearch(customerSearch)

    return customers.filter((customer) => {
      if (customerSearchField === 'cpf' && customer.person_type !== 'individual') {
        return false
      }

      if (customerSearchField === 'cnpj' && customer.person_type !== 'company') {
        return false
      }

      if (!search) {
        return true
      }

      if (customerSearchField === 'name') {
        return [customer.name, customer.trade_name ?? ''].some((value) =>
          normalizeCustomerSearch(value).includes(search),
        )
      }

      if (customerSearchField === 'code') {
        return normalizeCustomerSearch(customer.code).includes(search)
      }

      return normalizeCustomerSearch(customer.document ?? '').includes(search)
    })
  }, [customers, customerSearch, customerSearchField])

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
      setStatus('Selecione um cliente nos resultados e informe a validade do orçamento.')
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
            <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
              <label>
                Pesquisar por
                <select
                  value={customerSearchField}
                  disabled={submitting}
                  onChange={(event) => {
                    setCustomerSearchField(event.target.value as CustomerSearchField)
                    setCustomerSearch('')
                    setCustomerId('')
                  }}
                >
                  <option value="name">Nome</option>
                  <option value="code">Código</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                </select>
              </label>

              <label>
                {activeCustomerSearch.label}
                <input
                  type="search"
                  inputMode={activeCustomerSearch.inputMode}
                  placeholder={activeCustomerSearch.placeholder}
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
            </div>

            {customerSearch.trim() && !selectedCustomer && filteredCustomers.length > 0 && (
              <div
                className="max-h-64 overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-sm"
                aria-label="Resultados da pesquisa de clientes"
              >
                {filteredCustomers.slice(0, 8).map((customer) => (
                  <button
                    className="flex w-full items-start justify-between gap-4 rounded-md px-3 py-3 text-left transition hover:bg-[#f4f7ff]"
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      setCustomerId(customer.id)

                      if (customerSearchField === 'name') {
                        setCustomerSearch(customer.name)
                      } else if (customerSearchField === 'code') {
                        setCustomerSearch(customer.code)
                      } else {
                        setCustomerSearch(customer.document ?? '')
                      }
                    }}
                  >
                    <span>
                      <strong className="block text-sm">{customer.name}</strong>
                      {customer.trade_name && (
                        <small className="mt-1 block text-muted">{customer.trade_name}</small>
                      )}
                    </span>

                    <span className="text-right text-xs text-muted">
                      <strong className="block text-signal">{customer.code}</strong>
                      {customer.document && <span>{customer.document}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selectedCustomer ? (
              <div
                id="customer-search-feedback"
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
                role="status"
              >
                <span>
                  Cliente selecionado:{' '}
                  <strong>
                    {selectedCustomer.code} — {selectedCustomer.name}
                  </strong>
                </span>

                <button
                  className="font-semibold text-signal"
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setCustomerId('')
                    setCustomerSearch('')
                  }}
                >
                  Alterar
                </button>
              </div>
            ) : (
              <p id="customer-search-feedback" className="text-sm text-muted" role="status">
                {customerSearch.trim()
                  ? filteredCustomers.length === 0
                    ? `Nenhum cliente encontrado por ${activeCustomerSearch.label.toLowerCase()}.`
                    : `${filteredCustomers.length} cliente(s) encontrado(s). Clique no cliente desejado.`
                  : activeCustomerSearch.hint}
              </p>
            )}
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
