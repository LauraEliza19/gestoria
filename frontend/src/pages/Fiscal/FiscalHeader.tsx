import { Link } from 'react-router-dom'

type FiscalHeaderProps = {
  orderFilter: string
  fromProduction: boolean
  busy: boolean
  canCreate: boolean
  onStart: () => void
}

export function FiscalHeader({
  orderFilter,
  fromProduction,
  busy,
  canCreate,
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
          <Link
            className="secondary-button"
            to={`/pedidos?order_id=${orderFilter}${fromProduction ? '&from=production' : ''}`}
          >
            Voltar ao pedido
          </Link>
        )}

        {canCreate && (
          <button className="primary-button" disabled={busy} type="button" onClick={onStart}>
            {orderFilter ? '+ Nota deste pedido' : '+ Nova nota'}
          </button>
        )}
      </div>
    </header>
  )
}
