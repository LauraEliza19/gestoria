import type { FormEvent } from 'react'
import { SaveButton, SavingForm } from '../../components/forms/FormActions'
import { FormHeader } from '../../components/forms/FormHeader'
import type { FiscalLinkFormState, FiscalOrder } from './fiscalTypes'
import { formatFiscalMoney } from './fiscalUtils'
import { RequiredMark } from './FiscalRequired'

type FiscalLinkFormProps = {
  orders: FiscalOrder[]
  currentOrderId: string | null
  form: FiscalLinkFormState
  busy: boolean
  saving: boolean
  onAttempt: () => void
  closeDisabled: boolean
  onClose: () => void
  onChange: (form: FiscalLinkFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function FiscalLinkForm({
  orders,
  currentOrderId,
  form,
  busy,
  saving,
  onAttempt,
  closeDisabled,
  onClose,
  onChange,
  onSubmit,
}: FiscalLinkFormProps) {
  const availableOrders = orders.filter((order) => !currentOrderId || currentOrderId === order.id)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (busy) {
      event.preventDefault()
      return
    }
    onAttempt()
    onSubmit(event)
  }

  return (
    <section>
      <FormHeader
        module="Fiscal"
        title="Conciliar pedido vinculado"
        description="Confirme o pedido e registre o motivo da conciliação."
        mode="edit"
        heading="h3"
        dirty={form.order_id !== (currentOrderId || '') || form.reason !== ''}
        back={{ onClick: onClose, label: 'Voltar às notas fiscais' }}
        blocked={closeDisabled}
      />
      <SavingForm
        className="fiscal-form-grid"
        saving={saving}
        onInvalidCapture={onAttempt}
        onSubmit={handleSubmit}
      >
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

        <SaveButton
          className="secondary-button"
          saving={saving}
          disabled={busy || !form.order_id || form.reason.trim().length < 10}
        >
          Confirmar vínculo
        </SaveButton>
      </SavingForm>
    </section>
  )
}
