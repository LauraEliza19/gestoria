import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  Check,
  Clock,
  ShieldX,
  TriangleAlert,
  X,
} from 'lucide-react'
import type { FiscalDocument, FiscalDocumentType } from './fiscalTypes'
import { fiscalStatusMeta, formatFiscalMoney } from './fiscalUtils'

type FiscalSummaryProps = {
  documents: FiscalDocument[]
  type?: FiscalDocumentType
  statusFilter?: string
  onSelectType?: (type: FiscalDocumentType) => void
  onSelectStatus?: (status: string) => void
}

// Todos os status fiscais aparecem como indicadores, inclusive Denegada e Inutilizada.
export const FISCAL_SUMMARY_STATUSES = [
  { status: 'Autorizada', label: 'Autorizadas', icon: Check },
  { status: 'Em processamento', label: 'Em processamento', icon: Clock },
  { status: 'Rejeitada', label: 'Rejeitadas', icon: X },
  { status: 'Cancelada', label: 'Canceladas', icon: Ban },
  { status: 'Denegada', label: 'Denegadas', icon: ShieldX },
  { status: 'Inutilizada', label: 'Inutilizadas', icon: TriangleAlert },
] as const

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
        key: documentType,
        label: documentType === 'saida' ? 'Saídas' : 'Entradas',
        description:
          documentType === 'saida'
            ? 'Notas de saída (vendas) registradas'
            : 'Notas de entrada (fornecedores) registradas',
        count: items.length,
        hint: sum(items),
        tone: 'type',
        icon: documentType === 'saida' ? ArrowUpFromLine : ArrowDownToLine,
        active: type === documentType && !statusFilter,
        onClick: onSelectType ? () => onSelectType(documentType) : undefined,
      }
    }),
    ...FISCAL_SUMMARY_STATUSES.map(({ status, label, icon }) => {
      const items = byStatus(status)
      const meta = fiscalStatusMeta(status)

      return {
        key: status,
        label,
        description: meta.description,
        count: items.length,
        hint: sum(items),
        tone: meta.tone,
        icon,
        active: statusFilter === status,
        onClick: onSelectStatus
          ? () => onSelectStatus(statusFilter === status ? '' : status)
          : undefined,
      }
    }),
  ]

  return (
    <div
      className="fiscal-summary fiscal-summary-compact"
      role="group"
      aria-label="Resumo das notas fiscais"
    >
      {metrics.map(
        ({ key, label, description, count, hint, tone, icon: Icon, active, onClick }) => {
          const content = (
            <>
              <span className="fiscal-summary-label">
                <span className={`fiscal-summary-icon fiscal-summary-${tone}`} aria-hidden="true">
                  <Icon size={14} strokeWidth={2.5} />
                </span>
                {label}
              </span>
              <strong>{count}</strong>
              <small>{hint}</small>
            </>
          )

          return (
            <article
              key={key}
              className={active ? 'fiscal-summary-active' : ''}
              title={description}
            >
              {onClick ? (
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`${label}: ${count} ${count === 1 ? 'nota' : 'notas'}, total ${hint}. ${
                    active ? 'Filtro ativo.' : 'Clique para filtrar.'
                  }`}
                  onClick={onClick}
                >
                  {content}
                </button>
              ) : (
                <div className="fiscal-summary-body">{content}</div>
              )}
            </article>
          )
        },
      )}
    </div>
  )
}
