import type { FiscalDocument, FiscalDocumentType } from './fiscalTypes'
import { formatFiscalMoney } from './fiscalUtils'

type FiscalDocumentListProps = {
  documents: FiscalDocument[]
  loading: boolean
  orderFilter: string
  type: FiscalDocumentType
  search: string
  statusFilter: string
  canCreateForOrder: boolean
  busy: boolean
  onSelect: (document: FiscalDocument) => void
  onStartOrder: (orderId: string) => void
}

export function FiscalDocumentList({
  documents,
  loading,
  orderFilter,
  type,
  search,
  statusFilter,
  canCreateForOrder,
  busy,
  onSelect,
  onStartOrder,
}: FiscalDocumentListProps) {
  if (loading) {
    return <p className="table-status">Carregando...</p>
  }

  if (documents.length > 0) {
    return (
      <div className="data-table fiscal-table">
        <div className="data-table-row data-table-head">
          <span>Nota</span>
          <span>Participante</span>
          <span>Modelo</span>
          <span>Emissão</span>
          <span>Valor</span>
          <span>Status</span>
          <span>Ações</span>
        </div>

        {documents.map((document) => (
          <div className="data-table-row" key={document.id}>
            <span>
              <strong>NF {document.number}</strong>
              <small>
                Série {document.series}
                {document.is_legacy ? ' · histórica' : ''}
              </small>
            </span>

            <span>{document.participant_name}</span>
            <span>{document.model}</span>

            <span>{document.issue_date.split('-').reverse().join('/')}</span>

            <span>{formatFiscalMoney(document.value)}</span>
            <span>{document.status}</span>

            <span className="row-actions">
              <button type="button" onClick={() => onSelect(document)}>
                Detalhes
              </button>
            </span>
          </div>
        ))}
      </div>
    )
  }

  const isEmptyOrderContext = Boolean(orderFilter) && type === 'saida' && !search && !statusFilter

  return (
    <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center">
      {isEmptyOrderContext ? (
        <>
          <p className="font-semibold text-ink">Este pedido ainda não possui nota fiscal.</p>

          <p className="mt-2 text-sm text-muted">
            Inicie o registro fiscal com o pedido, cliente, itens e valores já vinculados.
          </p>

          {canCreateForOrder && (
            <button
              className="primary-button mt-4"
              disabled={busy}
              type="button"
              onClick={() => onStartOrder(orderFilter)}
            >
              Criar nota deste pedido
            </button>
          )}
        </>
      ) : (
        <>
          <p className="font-semibold text-ink">Nenhum documento encontrado.</p>

          <p className="mt-2 text-sm text-muted">
            {search || statusFilter
              ? 'Tente ajustar a busca ou os filtros.'
              : type === 'saida'
                ? 'As notas de saída aparecerão aqui.'
                : 'As notas de entrada aparecerão aqui.'}
          </p>
        </>
      )}
    </div>
  )
}
