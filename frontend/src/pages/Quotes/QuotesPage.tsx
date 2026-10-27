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
  code: string
  name: string
  price: string
}

type ProductSearchField = 'name' | 'code'

type PaymentTerms = 'cash' | 'installments'

type DraftItem = {
  key: string
  productId: string
  productSearch: string
  productSearchField: ProductSearchField
  quantity: string
  discountPercent: string
}

function newItem(): DraftItem {
  return {
    key: crypto.randomUUID(),
    productId: '',
    productSearch: '',
    productSearchField: 'name',
    quantity: '1',
    discountPercent: '0',
  }
}

type QuoteItem = {
  id: string
  product_id: string
  product_code: string
  product_name: string
  quantity: string
  unit_price: string
  discount_percent: string
  gross_amount: string
  discount_amount: string
  total_amount: string
}

type Quote = {
  id: string
  customer_name: string
  status: string
  created_at: string
  valid_until: string
  gross_amount: string
  general_discount_percent: string
  discount_amount: string
  total_amount: string
  payment_terms: PaymentTerms
  installment_count: number
  installment_amount: string
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

const productSearchConfig: Record<
  ProductSearchField,
  {
    label: string
    placeholder: string
    hint: string
  }
> = {
  name: {
    label: 'Nome',
    placeholder: 'Digite o nome do produto',
    hint: 'Pesquise pelo nome cadastrado no catálogo.',
  },
  code: {
    label: 'Código',
    placeholder: 'Ex.: PRO-000001',
    hint: 'Pesquise pelo código automático do produto.',
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

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[\s./-]/g, '')
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function isValidPercentage(value: string): boolean {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    return false
  }

  const percentage = Number(value)

  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
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
  const [generalDiscountPercent, setGeneralDiscountPercent] = useState('0')
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('cash')
  const [installmentCount, setInstallmentCount] = useState('2')
  const [submitting, setSubmitting] = useState(false)

  const activeCustomerSearch = customerSearchConfig[customerSearchField]
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null

  const filteredCustomers = useMemo(() => {
    const search = normalizeSearch(customerSearch)

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
          normalizeSearch(value).includes(search),
        )
      }

      if (customerSearchField === 'code') {
        return normalizeSearch(customer.code).includes(search)
      }

      return normalizeSearch(customer.document ?? '').includes(search)
    })
  }, [customers, customerSearch, customerSearchField])

  const selectedProductIds = useMemo(
    () => new Set(items.map((item) => item.productId).filter(Boolean)),
    [items],
  )

  const estimatedAmounts = useMemo(() => {
    let grossAmount = 0
    let amountAfterItemDiscounts = 0

    for (const item of items) {
      const product = products.find((candidate) => candidate.id === item.productId)
      const quantity = Number(item.quantity || 0)
      const discountPercent = isValidPercentage(item.discountPercent)
        ? Number(item.discountPercent)
        : 0

      const itemGrossAmount = roundMoney(Number(product?.price ?? 0) * quantity)
      const itemDiscountAmount = roundMoney((itemGrossAmount * discountPercent) / 100)
      const itemTotalAmount = roundMoney(itemGrossAmount - itemDiscountAmount)

      grossAmount += itemGrossAmount
      amountAfterItemDiscounts += itemTotalAmount
    }

    grossAmount = roundMoney(grossAmount)
    amountAfterItemDiscounts = roundMoney(amountAfterItemDiscounts)

    const validGeneralDiscount = isValidPercentage(generalDiscountPercent)
      ? Number(generalDiscountPercent)
      : 0

    const generalDiscountAmount = roundMoney(
      (amountAfterItemDiscounts * validGeneralDiscount) / 100,
    )
    const totalAmount = roundMoney(amountAfterItemDiscounts - generalDiscountAmount)
    const discountAmount = roundMoney(grossAmount - totalAmount)

    const installments =
      paymentTerms === 'installments' ? Math.max(2, Number(installmentCount) || 2) : 1

    return {
      grossAmount,
      discountAmount,
      totalAmount,
      installmentAmount: roundMoney(totalAmount / installments),
    }
  }, [generalDiscountPercent, installmentCount, items, paymentTerms, products])

  function updateItem(key: string, values: Partial<Omit<DraftItem, 'key'>>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...values } : item)))
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
        Number(item.quantity) > 1_000_000 ||
        !isValidPercentage(item.discountPercent),
    )

    if (invalidItem) {
      setStatus('Selecione os produtos, informe quantidades válidas e descontos entre 0% e 100%.')
      return
    }

    if (selectedProductIds.size !== items.length) {
      setStatus('Cada produto deve aparecer somente uma vez no orçamento.')
      return
    }

    if (!isValidPercentage(generalDiscountPercent)) {
      setStatus('Informe um desconto geral entre 0% e 100%, com até duas casas decimais.')
      return
    }

    const installments = Number(installmentCount)

    if (
      paymentTerms === 'installments' &&
      (!Number.isInteger(installments) || installments < 2 || installments > 24)
    ) {
      setStatus('Informe uma quantidade entre 2 e 24 parcelas.')
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
          general_discount_percent: Number(generalDiscountPercent),
          payment_terms: paymentTerms,
          installment_count: paymentTerms === 'installments' ? Number(installmentCount) : 1,
          items: items.map((item) => ({
            product_id: item.productId,
            quantity: Number(item.quantity),
            discount_percent: Number(item.discountPercent),
          })),
        }),
      })

      setQuotes((current) => [created, ...current])
      setReviewQuoteId(created.id)
      setCustomerId('')
      setCustomerSearch('')
      setItems([newItem()])
      setGeneralDiscountPercent('0')
      setPaymentTerms('cash')
      setInstallmentCount('2')
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

              const activeProductSearch = productSearchConfig[item.productSearchField]

              const normalizedProductSearch = normalizeSearch(item.productSearch)

              const filteredProducts = products.filter((product) => {
                const selectedInAnotherItem =
                  item.productId !== product.id && selectedProductIds.has(product.id)

                if (selectedInAnotherItem) {
                  return false
                }

                if (!normalizedProductSearch) {
                  return true
                }

                const searchableValue =
                  item.productSearchField === 'code' ? product.code : product.name

                return normalizeSearch(searchableValue).includes(normalizedProductSearch)
              })
              const quantityValue = Number(item.quantity)
              const itemDiscountPercent = isValidPercentage(item.discountPercent)
                ? Number(item.discountPercent)
                : 0

              const grossSubtotal = roundMoney(
                Number(selectedProduct?.price ?? 0) *
                  (Number.isFinite(quantityValue) ? quantityValue : 0),
              )
              const itemDiscountAmount = roundMoney((grossSubtotal * itemDiscountPercent) / 100)
              const subtotal = roundMoney(grossSubtotal - itemDiscountAmount)

              return (
                <div
                  className="grid items-end gap-3 rounded-lg border border-line bg-[#fbfcff] p-4 lg:grid-cols-[minmax(0,1fr)_120px_120px_130px_44px]"
                  key={item.key}
                >
                  <div className="grid gap-2">
                    <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                      <label>
                        Pesquisar por
                        <select
                          value={item.productSearchField}
                          disabled={submitting}
                          onChange={(event) =>
                            updateItem(item.key, {
                              productId: '',
                              productSearch: '',
                              productSearchField: event.target.value as ProductSearchField,
                            })
                          }
                        >
                          <option value="name">Nome</option>
                          <option value="code">Código</option>
                        </select>
                      </label>

                      <label>
                        {activeProductSearch.label}
                        <input
                          type="search"
                          autoComplete="off"
                          disabled={submitting}
                          placeholder={activeProductSearch.placeholder}
                          value={item.productSearch}
                          onChange={(event) =>
                            updateItem(item.key, {
                              productId: '',
                              productSearch: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>

                    {item.productSearch.trim() &&
                      !selectedProduct &&
                      filteredProducts.length > 0 && (
                        <div className="max-h-52 overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-sm">
                          {filteredProducts.slice(0, 8).map((product) => (
                            <button
                              className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-3 text-left transition hover:bg-[#f4f7ff]"
                              key={product.id}
                              type="button"
                              onClick={() =>
                                updateItem(item.key, {
                                  productId: product.id,
                                  productSearch:
                                    item.productSearchField === 'code'
                                      ? product.code
                                      : product.name,
                                })
                              }
                            >
                              <span>
                                <strong className="block text-sm">{product.name}</strong>

                                <small className="text-muted">{product.code}</small>
                              </span>

                              <strong className="text-sm text-signal">
                                {formatMoney(product.price)}
                              </strong>
                            </button>
                          ))}
                        </div>
                      )}

                    {selectedProduct ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          Produto selecionado:{' '}
                          <strong>
                            {selectedProduct.code} — {selectedProduct.name}
                          </strong>
                        </span>

                        <button
                          className="font-semibold text-signal"
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            updateItem(item.key, {
                              productId: '',
                              productSearch: '',
                            })
                          }
                        >
                          Alterar
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted" role="status">
                        {item.productSearch.trim()
                          ? filteredProducts.length === 0
                            ? `Nenhum produto encontrado por ${activeProductSearch.label.toLowerCase()}.`
                            : `${filteredProducts.length} produto(s) encontrado(s).`
                          : activeProductSearch.hint}
                      </p>
                    )}
                  </div>

                  <label>
                    Quantidade
                    <input
                      min="0.001"
                      step="0.001"
                      type="number"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.key, {
                          quantity: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Desconto (%)
                    <input
                      min="0"
                      max="100"
                      step="0.01"
                      type="number"
                      value={item.discountPercent}
                      onChange={(event) =>
                        updateItem(item.key, {
                          discountPercent: event.target.value,
                        })
                      }
                    />
                  </label>

                  <div className="pb-3">
                    <span className="block text-xs text-muted">Total do item</span>

                    <strong>{formatMoney(String(subtotal))}</strong>

                    {itemDiscountAmount > 0 && (
                      <small className="mt-1 block text-muted">
                        Desconto de {formatMoney(String(itemDiscountAmount))}
                      </small>
                    )}
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

          <div className="mt-5 grid gap-4 border-t border-line pt-5 md:grid-cols-3">
            <label>
              Condição de pagamento
              <select
                value={paymentTerms}
                disabled={submitting}
                onChange={(event) => setPaymentTerms(event.target.value as PaymentTerms)}
              >
                <option value="cash">À vista</option>
                <option value="installments">Crediário parcelado</option>
              </select>
            </label>

            <label>
              {paymentTerms === 'cash' ? 'Desconto à vista (%)' : 'Desconto geral (%)'}
              <input
                min="0"
                max="100"
                step="0.01"
                type="number"
                value={generalDiscountPercent}
                disabled={submitting}
                onChange={(event) => setGeneralDiscountPercent(event.target.value)}
              />
            </label>

            {paymentTerms === 'installments' ? (
              <label>
                Quantidade de parcelas
                <input
                  min="2"
                  max="24"
                  step="1"
                  type="number"
                  value={installmentCount}
                  disabled={submitting}
                  onChange={(event) => setInstallmentCount(event.target.value)}
                />
              </label>
            ) : (
              <div className="rounded-lg border border-line bg-[#fbfcff] p-4">
                <span className="block text-xs text-muted">Pagamento</span>
                <strong>Parcela única</strong>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <div>
              <span className="block text-xs text-muted">Valor bruto</span>
              <strong>{formatMoney(String(estimatedAmounts.grossAmount))}</strong>
            </div>

            <div>
              <span className="block text-xs text-muted">Descontos</span>
              <strong>− {formatMoney(String(estimatedAmounts.discountAmount))}</strong>
            </div>

            <div className="sm:text-right">
              <span className="block text-xs text-muted">Total do orçamento</span>
              <strong className="text-lg text-signal">
                {formatMoney(String(estimatedAmounts.totalAmount))}
              </strong>
            </div>
          </div>

          {paymentTerms === 'installments' && (
            <p className="mt-3 text-right text-sm font-semibold text-signal">
              {installmentCount || '0'} parcelas de{' '}
              {formatMoney(String(estimatedAmounts.installmentAmount))}
            </p>
          )}

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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-signal">
                Revisão da proposta
              </span>
              <h2 id="quote-review-title">Orçamento de {reviewedQuote.customer_name}</h2>
            </div>

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
          </div>

          <div className="mt-6 grid gap-4 border-y border-line py-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="block text-xs text-muted">Cliente</span>
              <strong>{reviewedQuote.customer_name}</strong>
            </div>

            <div>
              <span className="block text-xs text-muted">Válido até</span>
              <strong>{formatDate(reviewedQuote.valid_until)}</strong>
            </div>

            <div>
              <span className="block text-xs text-muted">Condição</span>
              <strong>
                {reviewedQuote.payment_terms === 'cash'
                  ? 'À vista'
                  : `${reviewedQuote.installment_count}x de ${formatMoney(
                      reviewedQuote.installment_amount,
                    )}`}
              </strong>
            </div>

            <div>
              <span className="block text-xs text-muted">Status</span>
              <strong>{quoteStatusLabels[reviewedQuote.status] || reviewedQuote.status}</strong>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase text-muted">
                  <th className="py-3 pr-4">Código</th>
                  <th className="py-3 pr-4">Produto</th>
                  <th className="py-3 pr-4">Quantidade</th>
                  <th className="py-3 pr-4">Preço unitário</th>
                  <th className="py-3 pr-4">Desconto</th>
                  <th className="py-3 text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                {reviewedQuote.items.map((item) => (
                  <tr className="border-b border-line" key={item.id}>
                    <td className="py-3 pr-4">{item.product_code}</td>
                    <td className="py-3 pr-4">{item.product_name}</td>
                    <td className="py-3 pr-4">{item.quantity}</td>
                    <td className="py-3 pr-4">{formatMoney(item.unit_price)}</td>
                    <td className="py-3 pr-4">
                      {Number(item.discount_percent).toLocaleString('pt-BR', {
                        maximumFractionDigits: 2,
                      })}
                      %
                    </td>
                    <td className="py-3 text-right">{formatMoney(item.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <div>
              <span className="block text-xs text-muted">Valor bruto</span>
              <strong>{formatMoney(reviewedQuote.gross_amount)}</strong>
            </div>

            <div>
              <span className="block text-xs text-muted">Descontos totais</span>
              <strong>− {formatMoney(reviewedQuote.discount_amount)}</strong>
            </div>

            <div className="sm:text-right">
              <span className="block text-xs text-muted">Total confirmado</span>
              <strong className="font-display text-xl text-signal">
                {formatMoney(reviewedQuote.total_amount)}
              </strong>
            </div>
          </div>

          {Number(reviewedQuote.general_discount_percent) > 0 && (
            <p className="mt-3 text-sm text-muted">
              {reviewedQuote.payment_terms === 'cash' ? 'Desconto à vista' : 'Desconto geral'}:{' '}
              <strong>
                {Number(reviewedQuote.general_discount_percent).toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })}
                %
              </strong>
            </p>
          )}

          <p className="mt-3 text-xs text-muted">
            Os preços, descontos e condições acima foram registrados no momento da criação do
            orçamento.
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
