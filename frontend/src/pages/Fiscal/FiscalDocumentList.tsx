import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  FileText,
  History,
  Minus,
  PenLine,
  Search,
  TriangleAlert,
  Waypoints,
  X,
} from 'lucide-react'
import type {
  FiscalDocument,
  FiscalDocumentType,
  FiscalModalView,
  FiscalOrganization,
  FiscalSort,
  FiscalSortKey,
} from './fiscalTypes'
import type { FiscalStepState } from './fiscalUtils'
import {
  FISCAL_MODEL_NAMES,
  fiscalParties,
  fiscalStatusClass,
  fiscalSteps,
  formatFiscalDate,
  formatFiscalDay,
  formatFiscalMoney,
  formatFiscalTime,
  formatTaxId,
  lastFiscalIteration,
  sortFiscalDocuments,
} from './fiscalUtils'

const PAGE_SIZES = [10, 25, 50]

const STEP_ICONS: Record<FiscalStepState, typeof Check> = {
  done: Check,
  processing: Clock,
  failed: X,
  warning: TriangleAlert,
  cancelled: Ban,
  idle: Minus,
}

type FiscalDocumentListProps = {
  documents: FiscalDocument[]
  organization?: FiscalOrganization
  loading: boolean
  orderFilter: string
  type: FiscalDocumentType
  search: string
  statusFilter: string
  resetKey: string
  canCreateForOrder: boolean
  canEdit: boolean
  busy: boolean
  selectedIds: Set<string>
  onToggleSelection: (ids: string[], checked: boolean) => void
  onOpen: (document: FiscalDocument, view: FiscalModalView, tab?: string) => void
  onStartOrder: (orderId: string) => void
}

export function FiscalDocumentList({
  documents,
  organization,
  loading,
  orderFilter,
  type,
  search,
  statusFilter,
  resetKey,
  canCreateForOrder,
  canEdit,
  busy,
  selectedIds,
  onToggleSelection,
  onOpen,
  onStartOrder,
}: FiscalDocumentListProps) {
  const [sort, setSort] = useState<FiscalSort>({ key: 'issue_date', direction: 'desc' })
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [page, setPage] = useState(1)

  const sorted = useMemo(
    () => sortFiscalDocuments(documents, sort, organization),
    [documents, sort, organization],
  )

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * pageSize
  const pageItems = sorted.slice(pageStart, pageStart + pageSize)
  const pageIds = pageItems.map((document) => document.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const somePageSelected = pageIds.some((id) => selectedIds.has(id))

  useEffect(() => {
    setPage(1)
  }, [resetKey, pageSize])

  function toggleSort(key: FiscalSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'issue_date' || key === 'updated_at' ? 'desc' : 'asc' },
    )
  }

  function sortHeader(key: FiscalSortKey, label: string) {
    const active = sort.key === key
    const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown

    return (
      <button
        className={`fiscal-sort ${active ? 'active' : ''}`}
        type="button"
        aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        onClick={() => toggleSort(key)}
      >
        {label}
        <Icon size={13} aria-hidden="true" />
      </button>
    )
  }

  if (loading) {
    return <p className="table-status">Carregando...</p>
  }

  if (documents.length > 0) {
    return (
      <>
        <div className="data-table fiscal-table">
          <div className="data-table-row data-table-head">
            <span className="fiscal-check">
              <input
                aria-label="Selecionar todas as notas desta página"
                type="checkbox"
                checked={allPageSelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = somePageSelected && !allPageSelected
                  }
                }}
                onChange={(event) => onToggleSelection(pageIds, event.target.checked)}
              />
            </span>
            <span>{sortHeader('emitter', 'Emitente')}</span>
            <span>{sortHeader('recipient', 'Destinatário')}</span>
            <span>{sortHeader('number', 'Número')}</span>
            <span>{sortHeader('value', 'Valor')}</span>
            <span>Modelo</span>
            <span>{sortHeader('issue_date', 'Emissão')}</span>
            <span>{sortHeader('updated_at', 'Últ. iteração')}</span>
            <span>Opções</span>
            <span>Status</span>
          </div>

          {pageItems.map((document) => {
            const { emitter, recipient } = fiscalParties(document, organization)
            const lastIteration = lastFiscalIteration(document)
            const checked = selectedIds.has(document.id)

            return (
              <div
                className={`data-table-row ${checked ? 'fiscal-row-selected' : ''}`}
                key={document.id}
              >
                <span className="fiscal-check">
                  <input
                    aria-label={`Selecionar NF ${document.number}`}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onToggleSelection([document.id], event.target.checked)}
                  />
                </span>

                <span>
                  <strong className="fiscal-cell-name" title={emitter.name}>
                    {emitter.name}
                  </strong>
                  <small>{formatTaxId(emitter.document)}</small>
                </span>

                <span>
                  <strong className="fiscal-cell-name" title={recipient.name}>
                    {recipient.name}
                  </strong>
                  <small>{formatTaxId(recipient.document)}</small>
                </span>

                <span>
                  <strong>{document.number}</strong>
                  <small>
                    Série {document.series}
                    {document.is_legacy ? ' · histórica' : ''}
                  </small>
                </span>

                <span className="fiscal-cell-money">{formatFiscalMoney(document.value)}</span>

                <span>{FISCAL_MODEL_NAMES[document.model] || document.model}</span>

                <span>
                  <strong>{formatFiscalDate(document.issue_date)}</strong>
                  <small>{formatFiscalTime(document.created_at)}</small>
                </span>

                <span>
                  <strong>{formatFiscalDay(lastIteration)}</strong>
                  <small>{formatFiscalTime(lastIteration)}</small>
                </span>

                <span className="fiscal-options">
                  <button
                    type="button"
                    title="Detalhes da nota"
                    aria-label={`Detalhes da NF ${document.number}`}
                    onClick={() => onOpen(document, 'details')}
                  >
                    <Search size={16} />
                  </button>
                  <button
                    type="button"
                    title="Visualizar DANFE"
                    aria-label={`Visualizar DANFE da NF ${document.number}`}
                    onClick={() => onOpen(document, 'danfe')}
                  >
                    <FileText size={16} />
                  </button>
                  <button
                    type="button"
                    title="Histórico de processamento"
                    aria-label={`Histórico da NF ${document.number}`}
                    onClick={() => onOpen(document, 'history')}
                  >
                    <History size={16} />
                  </button>
                  <button
                    type="button"
                    title="Ciclo de vida"
                    aria-label={`Ciclo de vida da NF ${document.number}`}
                    onClick={() => onOpen(document, 'lifecycle')}
                  >
                    <Waypoints size={16} />
                  </button>
                  {canEdit && document.allowed_statuses.length > 0 && (
                    <button
                      type="button"
                      title="Atualizar situação"
                      aria-label={`Atualizar situação da NF ${document.number}`}
                      onClick={() => onOpen(document, 'details', 'actions')}
                    >
                      <PenLine size={16} />
                    </button>
                  )}
                </span>

                <span className="fiscal-status-cell">
                  <span className="fiscal-steps">
                    {fiscalSteps(document).map((step) => {
                      const Icon = STEP_ICONS[step.state]

                      return (
                        <span
                          key={step.key}
                          className={`fiscal-step fiscal-step-${step.state}`}
                          title={`${step.label}: ${step.detail}`}
                          aria-label={`${step.label}: ${step.detail}`}
                          role="img"
                        >
                          <Icon size={14} strokeWidth={3} aria-hidden="true" />
                        </span>
                      )
                    })}
                  </span>
                  <span className={fiscalStatusClass(document.status)}>{document.status}</span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="fiscal-pagination">
          <div className="fiscal-pagination-nav">
            <button
              type="button"
              aria-label="Primeira página"
              disabled={currentPage === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Página anterior"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {currentPage} / {pageCount}
            </span>
            <button
              type="button"
              aria-label="Próxima página"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              aria-label="Última página"
              disabled={currentPage === pageCount}
              onClick={() => setPage(pageCount)}
            >
              <ChevronsRight size={16} />
            </button>

            <select
              aria-label="Itens por página"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} itens por página
                </option>
              ))}
            </select>
          </div>

          <span>
            {pageStart + 1} - {Math.min(pageStart + pageSize, sorted.length)} de {sorted.length}{' '}
            {sorted.length === 1 ? 'nota' : 'notas'}
          </span>
        </div>
      </>
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
