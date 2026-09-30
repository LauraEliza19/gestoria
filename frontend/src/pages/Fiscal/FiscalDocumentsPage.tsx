import { Link, useSearchParams } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'

import { formatFiscalDateTime, formatFiscalMoney, isActiveFiscalStatus } from './fiscalUtils'

import { FiscalSummary } from './FiscalSummary'
import { FiscalHeader } from './FiscalHeader'
import { FiscalDocumentList } from './FiscalDocumentList'
import { FiscalFilters } from './FiscalFilters'
import { FiscalDocumentOverview } from './FiscalDocumentOverview'
import { FiscalHistory } from './FiscalHistory'
import { FiscalStatusForm } from './FiscalStatusForm'
import { FiscalLinkForm } from './FiscalLinkForm'
import { FiscalDocumentForm } from './FiscalDocumentForm'
import { useFiscalDocuments } from './useFiscalDocuments'

export function FiscalDocumentsPage() {
  const { can } = useSession()
  const canEdit = can('fiscal:manage')

  const [params] = useSearchParams()
  const orderFilter = params.get('order_id') || ''
  const fromProduction = params.get('from') === 'production'

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

      {error && (
        <p className="table-status" role="alert">
          {error}
        </p>
      )}

      {notice && (
        <p className="info-note" role="status">
          {notice}
        </p>
      )}

      <FiscalSummary documents={documents} />

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
          busy={busy}
          onTypeChange={setType}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          onRefresh={() => void refreshDocuments()}
        />

        <FiscalDocumentList
          documents={visible}
          loading={loading}
          orderFilter={orderFilter}
          type={type}
          search={search}
          statusFilter={statusFilter}
          canCreateForOrder={canEdit && !isOccupied(orderFilter)}
          busy={busy}
          onSelect={selectDocument}
          onStartOrder={(orderId) => start(orderId)}
        />
      </section>

      {selected && (
        <section className="fiscal-detail page-card space-y-4">
          <button className="detail-close" type="button" onClick={() => setSelected(null)}>
            Fechar
          </button>

          <FiscalDocumentOverview document={selected} />

          {canEdit &&
            selected.document_type === 'saida' &&
            selected.snapshot_source === 'legacy_unverified' && (
              <FiscalLinkForm
                orders={orders}
                currentOrderId={selected.order_id}
                form={linkForm}
                busy={busy}
                onChange={setLinkForm}
                onSubmit={reconcileOrder}
              />
            )}

          {canEdit && (
            <FiscalStatusForm
              currentStatus={selected.status}
              allowedStatuses={selected.allowed_statuses}
              form={eventForm}
              busy={busy}
              onChange={setEventForm}
              onSubmit={statusEvent}
            />
          )}

          {canEdit &&
            selected.document_type === 'saida' &&
            selected.order_id &&
            !isActiveFiscalStatus(selected.status) && (
              <button
                className="secondary-button"
                disabled={busy}
                type="button"
                onClick={() => start(selected.order_id!)}
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

          {canEdit &&
            selected.document_type === 'entrada' &&
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

          <FiscalHistory events={selected.events} />
        </section>
      )}
    </div>
  )
}
