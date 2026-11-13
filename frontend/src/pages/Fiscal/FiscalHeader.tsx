import { FormExit } from '../../components/forms/FormActions'

type FiscalHeaderProps = {
  orderFilter: string
  fromProduction: boolean
  busy: boolean
  returnBlocked: boolean
  canCreate: boolean
  formOpen?: boolean
  dirty?: boolean
  onStart: () => void
}

export function FiscalHeader({
  orderFilter,
  fromProduction,
  busy,
  returnBlocked,
  dirty = false,
  canCreate,
  formOpen = false,
  onStart,
}: FiscalHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">Fiscal</p>
        <h1>Notas fiscais</h1>
        <p>Pedidos, documentos e histórico da operação.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {orderFilter && (
          <FormExit
            blocked={returnBlocked}
            dirty={dirty}
            to={`/pedidos?order_id=${orderFilter}${fromProduction ? '&from=production' : ''}`}
          >
            Voltar ao pedido
          </FormExit>
        )}

        {canCreate && (
          <button
            className="primary-button"
            disabled={busy}
            type="button"
            aria-controls="fiscal-new-document"
            aria-expanded={formOpen}
            title={formOpen ? 'Ir para o formulário aberto' : 'Abrir formulário de nova nota'}
            onClick={onStart}
          >
            {formOpen
              ? 'Ir para o formulário'
              : orderFilter
                ? '+ Nota deste pedido'
                : '+ Nova nota'}
          </button>
        )}
      </div>
    </header>
  )
}
