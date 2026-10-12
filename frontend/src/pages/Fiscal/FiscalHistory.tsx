import type { FiscalEvent } from './fiscalTypes'
import { FISCAL_ACTION_NAMES, fiscalStatusClass, formatFiscalDateTime } from './fiscalUtils'

type FiscalHistoryProps = {
  events: FiscalEvent[]
}

export function FiscalHistory({ events }: FiscalHistoryProps) {
  return (
    <>
      <h3>Histórico de ações</h3>

      {events.length > 0 ? (
        <ol className="fiscal-history">
          {events.map((event) => (
            <li key={event.id}>
              <span className="fiscal-history-dot" aria-hidden="true" />
              <div>
                <strong>{FISCAL_ACTION_NAMES[event.action] || event.action}</strong>
                <p>
                  {formatFiscalDateTime(event.created_at)} · usuário {event.actor_id}
                  {event.detail.status ? <> · <span className={fiscalStatusClass(event.detail.status)}>{event.detail.status}</span></> : ''}
                </p>
                {event.detail.reason && <p>Motivo: {event.detail.reason}</p>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">Nenhuma ação registrada.</p>
      )}
    </>
  )
}
