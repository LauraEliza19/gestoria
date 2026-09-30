import type { FiscalDocument } from './fiscalTypes'

type FiscalSummaryProps = {
  documents: FiscalDocument[]
}

export function FiscalSummary({ documents }: FiscalSummaryProps) {
  const metrics = [
    {
      label: 'Saídas',
      count: documents.filter((document) => document.document_type === 'saida').length,
    },
    {
      label: 'Entradas',
      count: documents.filter((document) => document.document_type === 'entrada').length,
    },
    {
      label: 'Autorizadas',
      count: documents.filter((document) => document.status === 'Autorizada').length,
    },
    {
      label: 'A conciliar',
      count: documents.filter((document) => document.snapshot_source === 'legacy_unverified')
        .length,
    },
  ]

  return (
    <div className="metric-grid fiscal-summary">
      {metrics.map(({ label, count }) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{count}</strong>
          <small>Todos os registros da empresa</small>
        </article>
      ))}
    </div>
  )
}
