import type { FiscalEvent } from './fiscalTypes'
import { FISCAL_ACTION_NAMES, formatFiscalDateTime } from './fiscalUtils'

type FiscalHistoryProps = {
  events: FiscalEvent[]
}

export function FiscalHistory({ events }: FiscalHistoryProps) {
  return (
    <>
      <h3>Histórico de ações</h3>

      {events.length > 0 ? (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id}>
              {formatFiscalDateTime(event.created_at)} ·{' '}
              {FISCAL_ACTION_NAMES[event.action] || event.action} · usuário {event.actor_id}
              {event.detail.status ? ` · ${event.detail.status}` : ''}
              {event.detail.reason ? ` · ${event.detail.reason}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhuma ação registrada.</p>
      )}
    </>
  )
}
