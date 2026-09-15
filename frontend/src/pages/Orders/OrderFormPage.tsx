import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { apiFetch } from '../../services/api'

type Customer = {
  id: string
  name: string
  is_active?: boolean
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

function formatMoney(value: string | number): string {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function OrderFormPage() {
  const navigate = useNavigate()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<DraftItem[]>([newItem()])
  const [proposal, setProposal] = useState<OrderProposal | null>(null)
  const [status, setStatus] = useState('Carregando clientes e produtos...')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch<Customer[]>('/api/customers'),
      apiFetch<Product[]>('/api/products'),
    ])
      .then(([customerList, productList]) => {
        setCustomers(customerList.filter((customer) => customer.is_active !== false))
        setProducts(productList.filter((product) => product.is_active !== false))
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

  const selectedProductIds = useMemo(
    () => new Set(items.map((item) => item.productId).filter(Boolean)),
    [items],
  )

  function updateItem(
    key: string,
    field: 'productId' | 'quantity',
    value: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
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
    setStatus('')

    if (!customerId) {
      setStatus('Selecione um cliente.')
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
      setSubmitting(true)

      const prepared = await apiFetch<OrderProposal>(
        '/api/orders/proposals',
        {
          method: 'POST',
          headers: {
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            customer_id: customerId,
            items: items.map((item) => ({
              product_id: item.productId,
              quantity: Number(item.quantity),
            })),
          }),
        },
      )

      setProposal(prepared)
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível preparar o pedido.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function cancelReview() {
    if (!proposal) return

    try {
      setSubmitting(true)

      await apiFetch(
        `/api/orders/proposals/${proposal.operation_id}/cancel`,
        { method: 'POST' },
      )

      setProposal(null)
      setStatus('')
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível cancelar a revisão.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmOrder() {
    if (!proposal) return

    try {
      setSubmitting(true)
      setStatus('')

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
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar o pedido.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (proposal) {
    const plan = proposal.envelope.payload

    return (
      <div className="page-wrap">
        <header className="page-header">
          <div>
            <p className="eyebrow">Confirmação segura</p>
            <h1>Revise o pedido</h1>
            <p>
              Confira os dados antes de descontar o estoque e registrar a venda.
            </p>
          </div>
        </header>

        <section className="page-card mx-auto max-w-[820px]">
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-[#effbf6] p-4 text-[#28745b]">
            <ShieldCheck className="mt-0.5 shrink-0" size={21} />
            <div>
              <strong className="block text-sm">Revisão protegida</strong>
              <p className="mt-1 text-xs leading-relaxed">
                Os dados foram assinados pelo servidor. Preços e estoque serão
                conferidos novamente durante a confirmação.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <span className="text-xs text-muted">Cliente</span>
            <strong className="mt-1 block text-lg">{plan.customer_name}</strong>
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
                  <span>
                    {formatMoney(
                      Number(item.quantity) * Number(item.unit_price),
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
            <span className="text-sm text-muted">Total do pedido</span>
            <strong className="font-display text-2xl">
              {formatMoney(plan.total_amount)}
            </strong>
          </div>

          {status && <p className="form-status mt-4">{status}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="primary-button"
              disabled={submitting}
              onClick={() => void confirmOrder()}
              type="button"
            >
              {submitting ? 'Confirmando...' : 'Confirmar e criar pedido'}
            </button>

            <button
              className="secondary-button"
              disabled={submitting}
              onClick={() => void cancelReview()}
              type="button"
            >
              Voltar e editar
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operação manual</p>
          <h1>Novo pedido</h1>
          <p>Selecione o cliente e monte os itens da venda.</p>
        </div>

        <Link className="secondary-button" to="/pedidos">
          Voltar para pedidos
        </Link>
      </header>

      <form
        className="page-card mx-auto grid max-w-[900px] gap-6"
        onSubmit={prepareOrder}
      >
        <label className="form-label">
          Cliente
          <select
            className="form-input"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="">Selecione um cliente</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>

        <div className="border-t border-line pt-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="eyebrow">Itens do pedido</p>
              <h2 className="font-display text-xl font-semibold">
                Produtos e quantidades
              </h2>
            </div>

            <button
              className="secondary-button"
              onClick={addItem}
              type="button"
            >
              <Plus size={16} />
              Adicionar produto
            </button>
          </div>

          <div className="grid gap-3">
            {items.map((item, index) => (
              <div
                className="grid items-end gap-3 rounded-lg border border-line bg-[#fbfcff] p-4 md:grid-cols-[minmax(0,1fr)_180px_42px]"
                key={item.key}
              >
                <label className="form-label">
                  Produto {index + 1}
                  <select
                    className="form-input"
                    value={item.productId}
                    onChange={(event) =>
                      updateItem(item.key, 'productId', event.target.value)
                    }
                  >
                    <option value="">Selecione um produto</option>
                    {products.map((product) => (
                      <option
                        disabled={
                          item.productId !== product.id &&
                          selectedProductIds.has(product.id)
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
                  Quantidade
                  <input
                    className="form-input"
                    min="0.001"
                    step="0.001"
                    type="number"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.key, 'quantity', event.target.value)
                    }
                  />
                </label>

                <button
                  aria-label={`Remover produto ${index + 1}`}
                  className="grid h-[46px] w-[42px] place-items-center rounded-lg border border-[#f2cbd1] bg-white text-[#d84f62] disabled:cursor-not-allowed disabled:opacity-40"
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
            Nenhum cliente ativo encontrado. Cadastre um cliente antes de criar
            o pedido.
          </p>
        )}

        {products.length === 0 && !status && (
          <p className="info-note">
            Nenhum produto ativo encontrado. Cadastre um produto antes de criar
            o pedido.
          </p>
        )}

        {status && <p className="form-status">{status}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            className="primary-button"
            disabled={
              submitting || customers.length === 0 || products.length === 0
            }
            type="submit"
          >
            {submitting ? 'Preparando...' : 'Revisar pedido'}
          </button>

          <Link className="secondary-button" to="/pedidos">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}