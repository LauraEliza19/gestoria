import type { FormEvent } from 'react'
import type { FiscalLinkFormState, FiscalOrder } from './fiscalTypes'
import { formatFiscalMoney } from './fiscalUtils'

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
        Pedido para conciliação
        <select
          required
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
        Justificativa
        <input
          required
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

      <button className="secondary-button" disabled={busy} type="submit">
        Confirmar vínculo
      </button>
    </form>
  )
}
