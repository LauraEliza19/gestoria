import type { FiscalEvent } from './fiscalTypes'
import { FISCAL_ACTION_NAMES, fiscalStatusClass, formatFiscalDateTime } from './fiscalUtils'

type FiscalHistoryProps = {
  events: FiscalEvent[]
}

export function FiscalHistory({ events }: FiscalHistoryProps) {
  const ordered = [...events].sort((first, second) =>
    second.created_at.localeCompare(first.created_at),
  )

  return (
    <section className="space-y-3">
      <h3 className="fiscal-modal-subtitle">Histórico de ações</h3>

      {ordered.length > 0 ? (
        <div className="data-table fiscal-history-table">
          <div className="data-table-row data-table-head">
            <span>Data</span>
            <span>Ação</span>
            <span>Situação</span>
            <span>Protocolo</span>
            <span>Usuário</span>
            <span>Motivo</span>
          </div>

          {ordered.map((event) => (
            <div className="data-table-row" key={event.id}>
              <span>{formatFiscalDateTime(event.created_at)}</span>
              <span>
                <strong>{FISCAL_ACTION_NAMES[event.action] || event.action}</strong>
                {event.detail.occurred_at && (
                  <small>Evento externo: {formatFiscalDateTime(event.detail.occurred_at)}</small>
                )}
              </span>
              <span>
                {event.detail.status ? (
                  <span className={fiscalStatusClass(event.detail.status)}>
                    {event.detail.status}
                  </span>
                ) : (
                  '—'
                )}
              </span>
              <span className="font-mono text-[12px]">{event.detail.protocol || '—'}</span>
              <span title={event.actor_id}>
                <small>usuário {event.actor_id.slice(0, 8)}</small>
              </span>
              <span>{event.detail.reason || '—'}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Nenhuma ação registrada.</p>
      )}
    </section>
  )
}
