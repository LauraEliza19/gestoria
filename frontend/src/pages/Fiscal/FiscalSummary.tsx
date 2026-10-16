import type { FiscalDocument, FiscalDocumentType } from './fiscalTypes'
import { formatFiscalMoney } from './fiscalUtils'

type FiscalSummaryProps = {
  documents: FiscalDocument[]
  type?: FiscalDocumentType
  statusFilter?: string
  onSelectType?: (type: FiscalDocumentType) => void
  onSelectStatus?: (status: string) => void
}

export function FiscalSummary({
  documents,
  type,
  statusFilter,
  onSelectType,
  onSelectStatus,
}: FiscalSummaryProps) {
  const sum = (items: FiscalDocument[]) =>
    formatFiscalMoney(String(items.reduce((total, document) => total + Number(document.value), 0)))

  const byType = (documentType: FiscalDocumentType) =>
    documents.filter((document) => document.document_type === documentType)
  const byStatus = (status: string) => documents.filter((document) => document.status === status)

  const metrics = [
    ...(['saida', 'entrada'] as const).map((documentType) => {
      const items = byType(documentType)

      return {
        label: documentType === 'saida' ? 'Saídas' : 'Entradas',
        count: items.length,
        hint: sum(items),
        active: type === documentType && !statusFilter,
        onClick: onSelectType ? () => onSelectType(documentType) : undefined,
      }
    }),
    ...['Autorizada', 'Em processamento', 'Rejeitada', 'Cancelada'].map((status) => {
      const items = byStatus(status)

      return {
        label:
          status === 'Autorizada'
            ? 'Autorizadas'
            : status === 'Rejeitada'
              ? 'Rejeitadas'
              : status === 'Cancelada'
                ? 'Canceladas'
                : status,
        count: items.length,
        hint: sum(items),
        active: statusFilter === status,
        onClick: onSelectStatus
          ? () => onSelectStatus(statusFilter === status ? '' : status)
          : undefined,
      }
    }),
  ]

  return (
    <div className="metric-grid fiscal-summary">
      {metrics.map(({ label, count, hint, active, onClick }) => {
        const content = (
          <>
            <span>{label}</span>
            <strong>{count}</strong>
            <small>{hint} · todos os registros</small>
          </>
        )

        return (
          <article key={label} className={active ? 'fiscal-summary-active' : ''}>
            {onClick ? (
              <button
                className="grid gap-2.5 border-0 bg-transparent p-0"
                type="button"
                aria-pressed={active}
                onClick={onClick}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </article>
        )
      })}
    </div>
  )
}
