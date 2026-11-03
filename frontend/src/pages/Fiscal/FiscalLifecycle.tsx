import { useState } from 'react'
import { Ban, Check, Clock, FilePlus, Link2, PackageCheck, TriangleAlert, X } from 'lucide-react'
import type { FiscalDocument, FiscalEvent } from './fiscalTypes'
import {
  FISCAL_ACTION_NAMES,
  fiscalStatusMeta,
  formatFiscalDateTime,
  formatRelativeTime,
} from './fiscalUtils'

type FiscalLifecycleProps = {
  document: FiscalDocument
}

const FISCAL_EVENT_ACTIONS = ['status_changed']

function lifecycleTitle(event: FiscalEvent): string {
  if (event.action === 'status_changed') {
    const titles: Record<string, string> = {
      Autorizada: 'Autorização de uso',
      Cancelada: 'Cancelamento',
      Rejeitada: 'Rejeição',
      Denegada: 'Denegação de uso',
      Inutilizada: 'Inutilização',
      'Em processamento': 'Reenvio para processamento',
    }

    return titles[event.detail.status || ''] || 'Situação atualizada'
  }

  return FISCAL_ACTION_NAMES[event.action] || event.action
}

function lifecycleIcon(event: FiscalEvent) {
  if (event.action === 'created') return FilePlus
  if (event.action === 'stock_received') return PackageCheck
  if (event.action === 'legacy_order_linked') return Link2

  const tone = fiscalStatusMeta(event.detail.status || '').tone
  if (tone === 'success') return Check
  if (tone === 'danger') return X
  if (tone === 'warning') return TriangleAlert
  if (tone === 'processing') return Clock
  return Ban
}

function lifecycleTone(event: FiscalEvent): string {
  if (event.action !== 'status_changed') {
    return event.action === 'stock_received' ? 'success' : 'processing'
  }

  return fiscalStatusMeta(event.detail.status || '').tone
}

// Legenda das cores e ícones usados na linha do tempo.
export const FISCAL_LIFECYCLE_LEGEND = [
  { tone: 'processing', icon: FilePlus, label: 'Registro, conciliação ou processamento' },
  { tone: 'success', icon: Check, label: 'Autorizada ou estoque recebido' },
  { tone: 'danger', icon: X, label: 'Rejeitada ou denegada' },
  { tone: 'warning', icon: TriangleAlert, label: 'Numeração inutilizada' },
  { tone: 'neutral', icon: Ban, label: 'Cancelada' },
] as const

function lifecycleLabel(event: FiscalEvent): string {
  const legend = FISCAL_LIFECYCLE_LEGEND.find((item) => item.tone === lifecycleTone(event))
  return legend ? legend.label : lifecycleTitle(event)
}

export function FiscalLifecycle({ document }: FiscalLifecycleProps) {
  const [showEvents, setShowEvents] = useState(true)
  const [showOccurrences, setShowOccurrences] = useState(true)

  const timeline = [...document.events]
    .sort((first, second) => first.created_at.localeCompare(second.created_at))
    .filter((event) => (FISCAL_EVENT_ACTIONS.includes(event.action) ? showEvents : showOccurrences))

  return (
    <section className="fiscal-lifecycle">
      <div
        className="fiscal-lifecycle-filters"
        role="group"
        aria-labelledby="fiscal-lifecycle-filter-label"
      >
        <strong id="fiscal-lifecycle-filter-label">Exibir</strong>
        <label>
          <input
            type="checkbox"
            checked={showEvents}
            onChange={(event) => setShowEvents(event.target.checked)}
          />
          Eventos fiscais
        </label>
        <label>
          <input
            type="checkbox"
            checked={showOccurrences}
            onChange={(event) => setShowOccurrences(event.target.checked)}
          />
          Ocorrências do sistema
        </label>
      </div>

      <div className="fiscal-lifecycle-legend" role="list" aria-label="Legenda do ciclo de vida">
        <strong>Legenda</strong>
        {FISCAL_LIFECYCLE_LEGEND.map(({ tone, icon: LegendIcon, label }) => (
          <span key={tone} role="listitem">
            <span className={`fiscal-legend-dot fiscal-timeline-${tone}`} aria-hidden="true">
              <LegendIcon size={12} strokeWidth={3} />
            </span>
            {label}
          </span>
        ))}
      </div>

      {timeline.length > 0 ? (
        <ol className="fiscal-timeline" aria-label="Linha do tempo da nota">
          {timeline.map((event, index) => {
            const Icon = lifecycleIcon(event)
            const when = event.detail.occurred_at || event.created_at

            return (
              <li key={event.id} className={index % 2 === 0 ? 'left' : 'right'}>
                <div className="fiscal-timeline-card">
                  <strong>{lifecycleTitle(event)}</strong>
                  <small>
                    {formatFiscalDateTime(when)} · {formatRelativeTime(when)}
                  </small>
                  {event.detail.protocol && <small>Protocolo {event.detail.protocol}</small>}
                  {event.detail.reason && <small>Motivo: {event.detail.reason}</small>}
                </div>
                <span
                  className={`fiscal-timeline-dot fiscal-timeline-${lifecycleTone(event)}`}
                  role="img"
                  aria-label={lifecycleLabel(event)}
                  title={lifecycleLabel(event)}
                >
                  <Icon size={18} strokeWidth={3} aria-hidden="true" />
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="py-8 text-center text-sm text-muted">Nenhum evento encontrado.</p>
      )}
    </section>
  )
}
