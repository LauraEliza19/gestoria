import type { FormEvent } from 'react'
import type { FiscalLinkFormState, FiscalOrder } from './fiscalTypes'
import { formatFiscalMoney } from './fiscalUtils'
import { RequiredMark } from './FiscalRequired'

type FiscalLinkFormProps = {
  orders: FiscalOrder[]
  currentOrderId: string | null
  form: FiscalLinkFormState
  busy: boolean
  onChange: (form: FiscalLinkFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function FiscalLinkForm({
  orders,
  currentOrderId,
  form,
  busy,
  onChange,
  onSubmit,
}: FiscalLinkFormProps) {
  const availableOrders = orders.filter((order) => !currentOrderId || currentOrderId === order.id)

  return (
    <form className="fiscal-form-grid" onSubmit={onSubmit}>
      <label>
        <span>
          Pedido para conciliação
          <RequiredMark />
        </span>
        <select
          required
          aria-required="true"
          value={form.order_id}
          onChange={(event) =>
            onChange({
              ...form,
              order_id: event.target.value,
            })
          }
        >
          <option value="">Selecione</option>

          {availableOrders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.id.slice(0, 8)} · {order.customer_name} ·{' '}
              {formatFiscalMoney(order.total_amount)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>
          Justificativa
          <RequiredMark />
        </span>
        <input
          required
          aria-required="true"
          placeholder="Mínimo de 10 caracteres"
          minLength={10}
          maxLength={500}
          value={form.reason}
          onChange={(event) =>
            onChange({
              ...form,
              reason: event.target.value,
            })
          }
        />
      </label>

      <button
        className="secondary-button"
        disabled={busy || !form.order_id || form.reason.trim().length < 10}
        type="submit"
      >
        Confirmar vínculo
      </button>
    </form>
  )
}
