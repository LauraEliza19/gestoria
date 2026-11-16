import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FormExit, SaveButton, SavingForm } from '../../components/forms/FormActions'
import { FormHeader, RequiredMark } from '../../components/forms/FormHeader'
import { useSaveAction } from '../../components/forms/useFormState'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { apiFetch, apiFetchItems } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'

type Customer = {
  id: string
  code: string
  name: string
  document: string | null
  trade_name: string | null
  person_type: 'individual' | 'company'
  is_active?: boolean
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
    hint: 'Pesquise manualmente pelo nome ou nome fantasia do cliente.',
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

type Product = {
  id: string
  name: string
  price: string
  stock_quantity: string
  unit_of_measure: string
  is_active?: boolean
}

type DraftItem = {
  key: string
  productId: string
  quantity: string
}

type PlanItem = {
  product_id: string
  product_name: string
  quantity: string
  unit_price: string
  unit_of_measure: string
}

type OrderPlan = {
  customer_id: string
  customer_name: string
  promised_at: string | null
  priority: 'normal' | 'high' | 'urgent'
  notes: string | null
  items: PlanItem[]
  total_amount: string
}

type OrderProposal = {
  operation_id: string
  status: string
  envelope: Record<string, unknown> & {
    payload: OrderPlan
    expires_at: string
  }
}

type CreatedOrder = {
  id: string
  customer_name: string
  total_amount: string
}

function newItem(): DraftItem {
  return {
    key: crypto.randomUUID(),
    productId: '',
    quantity: '1',
  }
}

function defaultPromisedAt(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(12, 0, 0, 0)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const priorityLabels = {
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
} as const

function formatMoney(value: string | number): string {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[\s./-]/g, '')
}

export function OrderFormPage() {
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()
  const requestedCustomerId = searchParams.get('customer_id')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSearchField, setCustomerSearchField] = useState<CustomerSearchField>('name')
  const [promisedAtBaseline] = useState(defaultPromisedAt)
  const [promisedAt, setPromisedAt] = useState(promisedAtBaseline)
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([newItem()])
  const [proposal, setProposal] = useState<OrderProposal | null>(null)
  const [status, setStatus] = useState('Carregando clientes e produtos...')
  const { busy, pendingAction, run } = useSaveAction<'prepare' | 'confirm' | 'cancel'>()
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
  const contextualCustomerId = customers.some((customer) => customer.id === requestedCustomerId)
    ? requestedCustomerId
    : ''
  const dirty =
    customerId !== contextualCustomerId ||
    promisedAt !== promisedAtBaseline ||
    priority !== 'normal' ||
    notes.trim() !== '' ||
    items.length !== 1 ||
    items.some((item) => item.productId !== '' || item.quantity !== '1')

  useEffect(() => {
    Promise.all([
      apiFetchItems<Customer>('/api/customers'),
      apiFetchItems<Product>('/api/products'),
    ])
      .then(([customerList, productList]) => {
        const activeCustomers = customerList.filter((customer) => customer.is_active !== false)

        setCustomers(activeCustomers)
        setProducts(productList.filter((product) => product.is_active !== false))

        if (
          requestedCustomerId &&
          activeCustomers.some((customer) => customer.id === requestedCustomerId)
        ) {
          setCustomerId(requestedCustomerId)
        }

        setStatus('')
      })
      .catch((error) => {
        setStatus(getErrorMessage(error, 'Não foi possível carregar os dados.'))
      })
  }, [requestedCustomerId])

  const selectedProductIds = useMemo(
    () => new Set(items.map((item) => item.productId).filter(Boolean)),
    [items],
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
    setItems((current) => {
      if (current.length === 1) return current
      return current.filter((item) => item.key !== key)
    })
  }

  async function prepareOrder(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      setStatus('')

      if (!customerId) {
        setStatus('Selecione um cliente.')
        return
      }

      if (!promisedAt || Number.isNaN(new Date(promisedAt).getTime())) {
        setStatus('Informe uma data e um horário válidos para a entrega.')
        return
      }

      if (
        items.some(
          (item) =>
            !item.productId ||
            !Number.isFinite(Number(item.quantity)) ||
            Number(item.quantity) <= 0,
        )
      ) {
        setStatus('Selecione os produtos e informe quantidades válidas.')
        return
      }

      if (selectedProductIds.size !== items.length) {
        setStatus('Cada produto deve aparecer somente uma vez no pedido.')
        return
      }

      try {
        const prepared = await apiFetch<OrderProposal>('/api/orders/proposals', {
          method: 'POST',
          headers: {
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            customer_id: customerId,
            promised_at: new Date(promisedAt).toISOString(),
            priority,
            notes: notes.trim() || null,
            items: items.map((item) => ({
              product_id: item.productId,
              quantity: Number(item.quantity),
            })),
          }),
        })

        setProposal(prepared)
      } catch (error) {
        setStatus(getErrorMessage(error, 'Não foi possível preparar o pedido.'))
      }
    }, 'prepare')
  }

  async function cancelReview() {
    if (!proposal) return

    await run(async () => {
      setStatus('')
      try {
        await apiFetch(`/api/orders/proposals/${proposal.operation_id}/cancel`, { method: 'POST' })
        setProposal(null)
      } catch (error) {
        setStatus(getErrorMessage(error, 'Não foi possível cancelar a revisão.'))
      }
    }, 'cancel')
  }

  async function confirmOrder() {
    if (!proposal) return

    await run(async () => {
      setStatus('')
      try {
        const order = await apiFetch<CreatedOrder>(
          `/api/orders/proposals/${proposal.operation_id}/confirm`,
          {
            method: 'POST',
            body: JSON.stringify({
              envelope: proposal.envelope,
            }),
          },
        )

        navigate('/pedidos', {
          replace: true,
          state: {
            notice: `Pedido criado para ${order.customer_name} no valor de ${formatMoney(order.total_amount)}.`,
          },
        })
      } catch (error) {
        setStatus(getErrorMessage(error, 'Não foi possível confirmar o pedido.'))
      }
    }, 'confirm')
  }

  if (proposal) {
    const plan = proposal.envelope.payload

    return (
      <div className="page-wrap">
        <FormHeader
          module="Pedidos"
          title="Revise o pedido"
          description="Confira os dados antes de descontar o estoque e registrar a venda."
          mode="create"
          back={{ onClick: () => void cancelReview(), label: 'Voltar para edição do pedido' }}
          dirty={dirty}
          blocked={busy}
          hasRequiredFields={false}
        />

        <section className="page-card mx-auto max-w-[820px]" aria-busy={busy}>
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-[#effbf6] p-4 text-[#28745b]">
            <ShieldCheck className="mt-0.5 shrink-0" size={21} />
            <div>
              <strong className="block text-sm">Revisão protegida</strong>
              <p className="mt-1 text-xs leading-relaxed">
                Os dados foram assinados pelo servidor. Preços e estoque serão conferidos novamente
                durante a confirmação.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <span className="text-xs text-muted">Cliente</span>
            <strong className="mt-1 block text-lg">{plan.customer_name}</strong>
          </div>

          <div className="mb-6 grid gap-4 rounded-lg border border-line bg-[#fbfcff] p-4 sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted">Entrega prometida</span>
              <strong className="mt-1 block text-sm">
                {plan.promised_at
                  ? new Date(plan.promised_at).toLocaleString('pt-BR')
                  : 'Não informada'}
              </strong>
            </div>
            <div>
              <span className="text-xs text-muted">Prioridade</span>
              <strong className="mt-1 block text-sm">{priorityLabels[plan.priority]}</strong>
            </div>
            {plan.notes && (
              <div className="sm:col-span-2">
                <span className="text-xs text-muted">Observações</span>
                <p className="mt-1 whitespace-pre-wrap text-sm">{plan.notes}</p>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[1.5fr_.6fr_.8fr_.8fr] gap-4 border-b border-line pb-3 text-[11px] font-bold uppercase text-muted">
                <span>Produto</span>
                <span>Quantidade</span>
                <span>Preço unitário</span>
                <span>Subtotal</span>
              </div>

              {plan.items.map((item) => (
                <div
                  className="grid grid-cols-[1.5fr_.6fr_.8fr_.8fr] items-center gap-4 border-b border-[#edf0f6] py-4 text-sm"
                  key={item.product_id}
                >
                  <strong>{item.product_name}</strong>
                  <span>
                    {item.quantity} {item.unit_of_measure}
                  </span>
                  <span>{formatMoney(item.unit_price)}</span>
                  <span>{formatMoney(Number(item.quantity) * Number(item.unit_price))}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
            <span className="text-sm text-muted">Total do pedido</span>
            <strong className="font-display text-2xl">{formatMoney(plan.total_amount)}</strong>
          </div>

          {status && (
            <p className="form-status mt-4" role="alert">
              {status}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <SaveButton
              saving={pendingAction === 'confirm'}
              disabled={busy}
              onClick={() => void confirmOrder()}
              type="button"
            >
              Confirmar e criar pedido
            </SaveButton>

            <SaveButton
              className="secondary-button"
              saving={pendingAction === 'cancel'}
              pendingLabel="Voltando..."
              disabled={busy}
              onClick={() => void cancelReview()}
              type="button"
            >
              Voltar e editar
            </SaveButton>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <FormHeader
        module="Pedidos"
        title="Novo pedido"
        description="Selecione o cliente e monte os itens da venda."
        mode="create"
        back={{ to: '/pedidos', label: 'Voltar para pedidos' }}
        dirty={dirty}
        blocked={busy}
      />

      <SavingForm
        className="page-card grid w-full gap-6"
        saving={busy}
        onInvalidCapture={() => setStatus('')}
        onSubmit={prepareOrder}
      >
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)_minmax(180px,.65fr)]">
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
              <label className="form-label">
                <span>Pesquisar por</span>
                <select
                  className="form-input"
                  value={customerSearchField}
                  onChange={(event) => {
                    setCustomerSearchField(event.target.value as CustomerSearchField)
                    setCustomerSearch('')
                    setCustomerId('')
                  }}
                >
                  <option value="name">Nome / manual</option>
                  <option value="code">Código</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                </select>
              </label>

              <label className="form-label">
                <span>
                  {activeCustomerSearch.label}
                  <RequiredMark />
                </span>
                <input
                  type="search"
                  inputMode={activeCustomerSearch.inputMode}
                  className="form-input"
                  placeholder={activeCustomerSearch.placeholder}
                  value={customerSearch}
                  autoComplete="off"
                  aria-describedby="order-customer-search-feedback"
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
                id="order-customer-search-feedback"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#cbd7ff] bg-[#f7f9ff] px-3 py-2 text-sm"
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
                  onClick={() => {
                    setCustomerId('')
                    setCustomerSearch('')
                  }}
                >
                  Alterar
                </button>
              </div>
            ) : (
              <p id="order-customer-search-feedback" className="text-sm text-muted" role="status">
                {customerSearch.trim()
                  ? filteredCustomers.length === 0
                    ? `Nenhum cliente encontrado por ${activeCustomerSearch.label.toLowerCase()}.`
                    : `${filteredCustomers.length} cliente(s) encontrado(s). Clique no cliente desejado.`
                  : activeCustomerSearch.hint}
              </p>
            )}
          </div>

          <label className="form-label">
            <span>
              Entrega prometida
              <RequiredMark />
            </span>
            <input
              required
              className="form-input"
              type="datetime-local"
              value={promisedAt}
              onChange={(event) => setPromisedAt(event.target.value)}
            />
            <small>Prazo combinado para retirada ou entrega.</small>
          </label>

          <label className="form-label">
            <span>Prioridade</span>
            <select
              className="form-input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as 'normal' | 'high' | 'urgent')}
            >
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
        </div>

        <label className="form-label">
          <span>Observações da produção</span>
          <textarea
            className="form-input min-h-24 resize-y"
            maxLength={1000}
            placeholder="Ex.: decoração, embalagem, retirada ou cuidados especiais."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <small>{notes.length}/1000 caracteres</small>
        </label>

        <div className="border-t border-line pt-5">
          <div className="mb-4 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Itens do pedido</p>
              <h2 className="font-display text-xl font-semibold">Produtos e quantidades</h2>
            </div>

            <button className="secondary-button w-full sm:w-auto" onClick={addItem} type="button">
              <Plus size={16} />
              Adicionar produto
            </button>
          </div>

          <div className="grid gap-3">
            {items.map((item, index) => (
              <div
                className="grid gap-4 rounded-lg border border-line bg-[#fbfcff] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(140px,180px)_46px] sm:items-end"
                key={item.key}
              >
                <label className="form-label">
                  <span>
                    Produto {index + 1}
                    <RequiredMark />
                  </span>
                  <select
                    required
                    className="form-input"
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
                        {product.name} — {formatMoney(product.price)} — estoque{' '}
                        {product.stock_quantity}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-label">
                  <span>
                    Quantidade
                    <RequiredMark />
                  </span>
                  <input
                    required
                    className="form-input"
                    min="0.001"
                    step="0.001"
                    type="number"
                    value={item.quantity}
                    onChange={(event) => updateItem(item.key, 'quantity', event.target.value)}
                  />
                </label>

                <button
                  aria-label={`Remover produto ${index + 1}`}
                  className="grid h-[46px] w-[46px] place-items-center rounded-lg border border-[#f2cbd1] bg-white text-[#d84f62] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={items.length === 1}
                  onClick={() => removeItem(item.key)}
                  type="button"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {customers.length === 0 && !status && (
          <p className="info-note">
            Nenhum cliente ativo encontrado. Cadastre um cliente antes de criar o pedido.
          </p>
        )}

        {products.length === 0 && !status && (
          <p className="info-note">
            Nenhum produto ativo encontrado. Cadastre um produto antes de criar o pedido.
          </p>
        )}

        {status && <p className="form-status">{status}</p>}

        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <SaveButton
            saving={pendingAction === 'prepare'}
            disabled={busy || customers.length === 0 || products.length === 0}
          >
            Revisar pedido
          </SaveButton>
          <FormExit to="/pedidos" blocked={busy} dirty={dirty}>
            Cancelar
          </FormExit>
        </div>
      </SavingForm>
    </div>
  )
}
