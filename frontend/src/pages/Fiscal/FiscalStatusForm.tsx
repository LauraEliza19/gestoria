import type { FormEvent } from 'react'
import type { FiscalEventFormState } from './fiscalTypes'
import { fiscalStatusMeta } from './fiscalUtils'

type FiscalStatusFormProps = {
  currentStatus: string
  allowedStatuses: string[]
  form: FiscalEventFormState
  busy: boolean
  onChange: (form: FiscalEventFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function FiscalStatusForm({
  currentStatus,
  allowedStatuses,
  form,
  busy,
  onChange,
  onSubmit,
}: FiscalStatusFormProps) {
  if (allowedStatuses.length === 0) {
    return null
  }

  const datedEvent = ['Autorizada', 'Cancelada'].includes(form.status)
  const needsProtocol =
    form.status === 'Autorizada' || (form.status === 'Cancelada' && currentStatus === 'Autorizada')
  const selectedMeta = form.status ? fiscalStatusMeta(form.status) : null

  return (
    <section className="fiscal-event-panel">
      <div className="fiscal-section-heading">
        <div>
          <h3>Atualizar situação fiscal</h3>
          <p>Registre somente um evento que já tenha ocorrido no serviço fiscal externo.</p>
        </div>
        <span className="fiscal-current-state">Atual: {currentStatus}</span>
      </div>

      <form className="fiscal-form-grid" onSubmit={onSubmit}>
        <label>
          Próxima situação
          <select
            required
            value={form.status}
            onChange={(event) =>
              onChange({
                status: event.target.value,
                occurred_at: '',
                protocol: '',
                reason: '',
              })
            }
          >
            <option value="">Selecione uma transição</option>
            {allowedStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>

        {datedEvent && (
          <label>
            Data e hora do evento externo
            <input
              required
              type="datetime-local"
              value={form.occurred_at}
              onChange={(event) => onChange({ ...form, occurred_at: event.target.value })}
            />
          </label>
        )}

        {datedEvent && (
          <label>
            Protocolo externo{needsProtocol ? ' (obrigatório)' : ''}
            <input
              required={needsProtocol}
              maxLength={120}
              value={form.protocol}
              onChange={(event) => onChange({ ...form, protocol: event.target.value })}
            />
          </label>
        )}

        {form.status === 'Cancelada' && (
          <label>
            Motivo do cancelamento
            <input
              required
              minLength={3}
              maxLength={500}
              value={form.reason}
              onChange={(event) => onChange({ ...form, reason: event.target.value })}
            />
          </label>
        )}

        {selectedMeta && (
          <div className="fiscal-event-feedback" role="status">
            <strong>{selectedMeta.label}</strong>
            <span>{selectedMeta.description}</span>
          </div>
        )}

        <button className="primary-button" disabled={busy} type="submit">
          {busy ? 'Registrando…' : 'Registrar evento'}
        </button>
      </form>
    </section>
  )
}
