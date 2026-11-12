import type { FormEvent } from 'react'
import type { FiscalEventFormState } from './fiscalTypes'
import {
  CRITICAL_FISCAL_STATUSES,
  fiscalEventNeedsProtocol,
  fiscalStatusConfirmation,
  fiscalStatusMeta,
  isFiscalEventFormValid,
} from './fiscalUtils'
import { RequiredMark, RequiredLegend } from './FiscalRequired'

type FiscalStatusFormProps = {
  currentStatus: string
  allowedStatuses: string[]
  form: FiscalEventFormState
  busy: boolean
  documentLabel?: string
  onChange: (form: FiscalEventFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function FiscalStatusForm({
  currentStatus,
  allowedStatuses,
  form,
  busy,
  documentLabel = 'esta nota',
  onChange,
  onSubmit,
}: FiscalStatusFormProps) {
  if (allowedStatuses.length === 0) {
    return null
  }

  const datedEvent = ['Autorizada', 'Cancelada'].includes(form.status)
  const needsProtocol = fiscalEventNeedsProtocol(form.status, currentStatus)
  const selectedMeta = form.status ? fiscalStatusMeta(form.status) : null
  const isValid = isFiscalEventFormValid(form, currentStatus, allowedStatuses)
  const isCritical = CRITICAL_FISCAL_STATUSES.includes(form.status)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!isValid) {
      event.preventDefault()
      return
    }

    const question = fiscalStatusConfirmation(form.status, documentLabel)

    if (question && !window.confirm(question)) {
      event.preventDefault()
      return
    }

    onSubmit(event)
  }

  return (
    <section className="fiscal-event-panel">
      <div className="fiscal-section-heading">
        <div>
          <h3>Atualizar situação fiscal</h3>
          <p>Registre somente um evento que já tenha ocorrido no serviço fiscal externo.</p>
        </div>
        <span className="fiscal-current-state">Atual: {currentStatus}</span>
      </div>

      <RequiredLegend />

      <form className="fiscal-form-grid" onSubmit={handleSubmit}>
        <label>
          <span>
            Próxima situação
            <RequiredMark />
          </span>
          <select
            required
            aria-required="true"
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
            <span>
              Data e hora do evento externo
              <RequiredMark />
            </span>
            <input
              required
              aria-required="true"
              type="datetime-local"
              value={form.occurred_at}
              onChange={(event) => onChange({ ...form, occurred_at: event.target.value })}
            />
          </label>
        )}

        {datedEvent && (
          <label>
            <span>
              Protocolo externo
              {needsProtocol && <RequiredMark />}
            </span>
            <input
              required={needsProtocol}
              aria-required={needsProtocol}
              maxLength={120}
              placeholder="Ex.: 135240000000000"
              value={form.protocol}
              onChange={(event) => onChange({ ...form, protocol: event.target.value })}
            />
          </label>
        )}

        {form.status === 'Cancelada' && (
          <label>
            <span>
              Motivo do cancelamento
              <RequiredMark />
            </span>
            <input
              required
              aria-required="true"
              minLength={3}
              maxLength={500}
              placeholder="Mínimo de 3 caracteres"
              value={form.reason}
              onChange={(event) => onChange({ ...form, reason: event.target.value })}
            />
          </label>
        )}

        {selectedMeta && (
          <div
            className={`fiscal-event-feedback ${isCritical ? 'fiscal-event-feedback-critical' : ''}`}
            role="status"
          >
            <strong>{selectedMeta.label}</strong>
            <span>{selectedMeta.description}</span>
            {isCritical && <span>Você precisará confirmar antes do registro.</span>}
          </div>
        )}

        <div className="fiscal-event-submit">
          <button
            className="primary-button"
            disabled={busy || !isValid}
            aria-disabled={busy || !isValid}
            type="submit"
          >
            {busy ? 'Registrando…' : 'Registrar evento'}
          </button>
          {!isValid && !busy && (
            <small className="text-muted">
              Preencha todos os campos obrigatórios (*) para habilitar o registro.
            </small>
          )}
        </div>
      </form>
    </section>
  )
}
