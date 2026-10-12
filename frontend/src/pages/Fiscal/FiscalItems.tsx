import type { FiscalItem } from './fiscalTypes'
import { fiscalItemTotal, formatFiscalMoney, formatQuantity } from './fiscalUtils'

type FiscalItemsProps = {
  items: FiscalItem[]
  documentValue?: string
}

export function FiscalItems({ items, documentValue }: FiscalItemsProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Nenhum item registrado nesta nota.</p>
  }

  const total = items.reduce((sum, item) => sum + fiscalItemTotal(item), 0)

  return (
    <div className="space-y-4">
      <div className="data-table fiscal-items-table">
        <div className="data-table-row data-table-head">
          <span>Produto</span>
          <span>NCM</span>
          <span>CEST</span>
          <span>Qtd.</span>
          <span>Valor unit.</span>
          <span>Total</span>
        </div>

        {items.map((item, index) => (
          <div className="data-table-row" key={item.id || `${item.product_id}-${index}`}>
            <span>
              <strong>{item.product_name}</strong>
              {item.fiscal_snapshot?.fiscal_origin && (
                <small>Origem {item.fiscal_snapshot.fiscal_origin}</small>
              )}
            </span>
            <span>{item.fiscal_snapshot?.ncm_code || '—'}</span>
            <span>{item.fiscal_snapshot?.cest_code || '—'}</span>
            <span>
              {formatQuantity(item.quantity)} {item.unit_of_measure || ''}
            </span>
            <span>{formatFiscalMoney(item.unit_price)}</span>
            <span>
              <strong>{formatFiscalMoney(String(fiscalItemTotal(item)))}</strong>
            </span>
          </div>
        ))}
      </div>

      <div className="detail-grid">
        <span>
          Itens
          <strong>{items.length}</strong>
        </span>
        <span>
          Total dos produtos
          <strong>{formatFiscalMoney(String(total))}</strong>
        </span>
        <span>
          Valor total da nota
          <strong>{formatFiscalMoney(documentValue ?? String(total))}</strong>
        </span>
      </div>
    </div>
  )
}
