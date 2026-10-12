import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { useSession } from '../../contexts/SessionContext'

import type { FiscalDocument, FiscalModalView } from './fiscalTypes'
import {
  buildFiscalCsv,
  downloadTextFile,
  formatFiscalDateTime,
  formatFiscalMoney,
  isActiveFiscalStatus,
} from './fiscalUtils'

import { FiscalSummary } from './FiscalSummary'
import { FiscalHeader } from './FiscalHeader'
import { FiscalDocumentList } from './FiscalDocumentList'
import { FiscalFilters } from './FiscalFilters'
import { FiscalToolbar } from './FiscalToolbar'
import { FiscalModal } from './FiscalModal'
import { FiscalDocumentDetails } from './FiscalDocumentDetails'
import { FiscalDanfe } from './FiscalDanfe'
import { FiscalLifecycle } from './FiscalLifecycle'
import { FiscalPrintArea } from './FiscalPrintArea'
import { FiscalHistory } from './FiscalHistory'
import { FiscalStatusForm } from './FiscalStatusForm'
import { FiscalLinkForm } from './FiscalLinkForm'
import { FiscalDocumentForm } from './FiscalDocumentForm'
import { useFiscalDocuments } from './useFiscalDocuments'

const MODAL_TITLES: Record<FiscalModalView, string> = {
  details: 'Detalhes da nota fiscal',
  danfe: 'Visualizar DANFE',
  history: 'Histórico de processamento',
  lifecycle: 'Ciclo de vida da nota',
}

export function FiscalDocumentsPage() {
  const { can, session } = useSession()
  const organization = session.organization
  const canEdit = can('fiscal:manage')

  const [params] = useSearchParams()
  const orderFilter = params.get('order_id') || ''
  const fromProduction = params.get('from') === 'production'

  const [modalView, setModalView] = useState<FiscalModalView | null>(null)
  const [modalTab, setModalTab] = useState<string | undefined>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [printDocuments, setPrintDocuments] = useState<FiscalDocument[]>([])
  const [toolbarNotice, setToolbarNotice] = useState('')

  const {
    documents,
    orders,
    products,
    suppliers,
    loading,
    busy,
    error,
    notice,
    type,
    setType,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    clearFilters,
    typeCounts,
    showForm,
    setShowForm,
    form,
    setForm,
    draftItems,
    setDraftItems,
    supplierForm,
    setSupplierForm,
    selected,
    setSelected,
    eventForm,
    setEventForm,
    linkForm,
    setLinkForm,
    visible,
    contextOrder,
    isOccupied,
    selectDocument,
    start,
    create,
    createSupplier,
    reconcileOrder,
    statusEvent,
    refreshDocuments,
    receiveStock,
  } = useFiscalDocuments(orderFilter)

  const selectedDocuments = useMemo(
    () => visible.filter((document) => selectedIds.has(document.id)),
    [visible, selectedIds],
  )

  useEffect(() => {
    setSelectedIds(new Set())
  }, [type])

  useEffect(() => {
    if (!toolbarNotice) {
      return
    }

    const timer = window.setTimeout(() => setToolbarNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [toolbarNotice])

  const closeModal = useCallback(() => {
    setModalView(null)
    setModalTab(undefined)
    setSelected(null)
  }, [setSelected])

  const finishPrint = useCallback(() => setPrintDocuments([]), [])

  function openDocument(document: FiscalDocument, view: FiscalModalView, tab?: string) {
    selectDocument(document)
    setModalTab(tab)
    setModalView(view)
  }

  function toggleSelection(ids: string[], checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)))
      return next
    })
  }

  function exportCsv() {
    const rows = selectedDocuments.length > 0 ? selectedDocuments : visible
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(
      `notas-${type === 'saida' ? 'saida' : 'entrada'}-${stamp}.csv`,
      buildFiscalCsv(rows, organization),
      'text/csv',
    )
    setToolbarNotice(`${rows.length} ${rows.length === 1 ? 'nota exportada' : 'notas exportadas'}.`)
  }

  async function copyKeys() {
    const keys = selectedDocuments
      .map((document) => document.access_key)
      .filter((key): key is string => Boolean(key))

    if (keys.length === 0) {
      setToolbarNotice('As notas selecionadas não possuem chave de acesso registrada.')
      return
    }

    try {
      await navigator.clipboard.writeText(keys.join('\n'))
      setToolbarNotice(
        `${keys.length} ${keys.length === 1 ? 'chave copiada' : 'chaves copiadas'}` +
          (keys.length < selectedDocuments.length ? ' (algumas notas não têm chave).' : '.'),
      )
    } catch {
      setToolbarNotice('Não foi possível acessar a área de transferência.')
    }
  }

  const statusActions =
    selected && canEdit ? (
      <>
        {selected.document_type === 'saida' && selected.snapshot_source === 'legacy_unverified' && (
          <FiscalLinkForm
            orders={orders}
            currentOrderId={selected.order_id}
            form={linkForm}
            busy={busy}
            onChange={setLinkForm}
            onSubmit={reconcileOrder}
          />
        )}

        <FiscalStatusForm
          currentStatus={selected.status}
          allowedStatuses={selected.allowed_statuses}
          form={eventForm}
          busy={busy}
          onChange={setEventForm}
          onSubmit={statusEvent}
        />

        {selected.document_type === 'saida' &&
          selected.order_id &&
          !isActiveFiscalStatus(selected.status) && (
            <button
              className="secondary-button"
              disabled={busy}
              type="button"
              onClick={() => {
                const orderId = selected.order_id!
                closeModal()
                start(orderId)
              }}
            >
              Reemitir em novo registro
            </button>
          )}

        {selected.stock_received_at && (
          <p className="info-note">
            Recebimento registrado em {formatFiscalDateTime(selected.stock_received_at)}.
            {selected.status === 'Cancelada' ? ' O cancelamento estornou esse recebimento.' : ''}
          </p>
        )}

        {selected.document_type === 'entrada' &&
          selected.status === 'Autorizada' &&
          !selected.is_legacy &&
          !selected.stock_received_at && (
            <button
              className="primary-button"
              disabled={busy}
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Confirma o recebimento físico dos produtos? Esta ação adiciona as quantidades ao estoque uma única vez.',
                  )
                ) {
                  void receiveStock()
                }
              }}
            >
              Confirmar recebimento no estoque
            </button>
          )}

        {selected.allowed_statuses.length === 0 &&
          !(selected.document_type === 'saida' && selected.order_id) && (
            <p className="text-sm text-muted">
              Esta nota está em uma situação final e não aceita novos eventos.
            </p>
          )}
      </>
    ) : undefined

  return (
    <div className="page-wrap">
      <FiscalHeader
        orderFilter={orderFilter}
        fromProduction={fromProduction}
        busy={busy}
        canCreate={canEdit && (!orderFilter || !isOccupied(orderFilter))}
        onStart={() => start()}
      />

      <p className="info-note">
        Este módulo registra documentos e eventos informados pelo responsável. A emissão e a
        autorização fiscal dependem de um serviço externo.
      </p>

      {error && !modalView && (
        <div className="fiscal-feedback fiscal-feedback-error" role="alert">
          <strong>Não foi possível concluir a operação</strong>
          <span>{error}</span>
        </div>
      )}

      {notice && !modalView && (
        <div className="fiscal-feedback fiscal-feedback-success" role="status">
          <strong>Operação concluída</strong>
          <span>{notice}</span>
        </div>
      )}

      <FiscalSummary
        documents={documents}
        type={type}
        statusFilter={statusFilter}
        onSelectType={(documentType) => {
          setType(documentType)
          setStatusFilter('')
        }}
        onSelectStatus={setStatusFilter}
      />

      {showForm && canEdit && (
        <FiscalDocumentForm
          form={form}
          setForm={setForm}
          orders={orders}
          suppliers={suppliers}
          products={products}
          draftItems={draftItems}
          setDraftItems={setDraftItems}
          supplierForm={supplierForm}
          setSupplierForm={setSupplierForm}
          busy={busy}
          loading={loading}
          isOccupied={isOccupied}
          onSubmit={create}
          onCreateSupplier={createSupplier}
          onClose={() => setShowForm(false)}
        />
      )}

      <section className="page-card fiscal-panel">
        {orderFilter && (
          <div className="info-note flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Documentos do pedido {orderFilter.slice(0, 8)}</p>

              {contextOrder && (
                <p className="mt-1 text-sm">
                  Cliente: {contextOrder.customer_name} · Total:{' '}
                  {formatFiscalMoney(contextOrder.total_amount)}
                </p>
              )}
            </div>

            <Link className="shrink-0 font-semibold" to="/notas-fiscais">
              Ver todas as notas
            </Link>
          </div>
        )}

        <FiscalFilters
          type={type}
          search={search}
          statusFilter={statusFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          counts={typeCounts}
          busy={busy}
          onTypeChange={setType}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClear={clearFilters}
          onRefresh={() => void refreshDocuments()}
        />

        <FiscalToolbar
          selectedCount={selectedDocuments.length}
          visibleCount={visible.length}
          onExport={exportCsv}
          onPrint={() => setPrintDocuments(selectedDocuments)}
          onCopyKeys={() => void copyKeys()}
          onClearSelection={() => setSelectedIds(new Set())}
        />

        {toolbarNotice && (
          <p className="fiscal-toolbar-notice" role="status">
            {toolbarNotice}
          </p>
        )}

        <FiscalDocumentList
          documents={visible}
          organization={organization}
          loading={loading}
          orderFilter={orderFilter}
          type={type}
          search={search}
          statusFilter={statusFilter}
          resetKey={`${type}|${search}|${statusFilter}|${orderFilter}|${dateFrom}|${dateTo}`}
          canCreateForOrder={canEdit && !isOccupied(orderFilter)}
          canEdit={canEdit}
          busy={busy}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onOpen={openDocument}
          onStartOrder={(orderId) => start(orderId)}
        />
      </section>

      {selected && modalView && (
        <FiscalModal
          title={MODAL_TITLES[modalView]}
          document={selected}
          organization={organization}
          wide={modalView === 'details' || modalView === 'danfe'}
          showContext={modalView !== 'details'}
          footer={
            modalView === 'danfe' ? (
              <button
                className="primary-button gap-2"
                type="button"
                onClick={() => setPrintDocuments([selected])}
              >
                <Printer size={16} aria-hidden="true" />
                Imprimir
              </button>
            ) : modalView !== 'details' ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setModalView('details')}
              >
                Ver detalhes da nota
              </button>
            ) : undefined
          }
          onClose={closeModal}
        >
          {error && (
            <div className="fiscal-feedback fiscal-feedback-error" role="alert">
              <strong>Não foi possível concluir a operação</strong>
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="fiscal-feedback fiscal-feedback-success" role="status">
              <strong>Operação concluída</strong>
              <span>{notice}</span>
            </div>
          )}

          {modalView === 'details' && (
            <FiscalDocumentDetails
              key={`${selected.id}-${modalTab || 'nfe'}`}
              document={selected}
              organization={organization}
              initialTab={modalTab}
              actions={statusActions}
              history={<FiscalHistory events={selected.events} />}
            />
          )}

          {modalView === 'danfe' && <FiscalDanfe document={selected} organization={organization} />}

          {modalView === 'history' && <FiscalHistory events={selected.events} />}

          {modalView === 'lifecycle' && <FiscalLifecycle document={selected} />}
        </FiscalModal>
      )}

      <FiscalPrintArea
        documents={printDocuments}
        organization={organization}
        onDone={finishPrint}
      />
    </div>
  )
}
