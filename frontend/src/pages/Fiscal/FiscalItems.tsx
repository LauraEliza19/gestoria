import type { FiscalItem } from './fiscalTypes'
import { formatFiscalMoney } from './fiscalUtils'

type FiscalItemsProps = {
  items: FiscalItem[]
}

export function FiscalItems({ items }: FiscalItemsProps) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item.product_id}-${index}`}>
          {item.product_name} · {item.quantity} {item.unit_of_measure || ''} ×{' '}
          {formatFiscalMoney(item.unit_price)}
        </li>
      ))}
    </ul>
  )
}
