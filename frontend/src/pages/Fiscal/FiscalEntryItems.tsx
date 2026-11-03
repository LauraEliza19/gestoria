import type { Dispatch, SetStateAction } from 'react'
import type { FiscalDraftItem, FiscalProduct } from './fiscalTypes'
import { FISCAL_UNIT_NAMES, createEmptyFiscalItem, formatUnit } from './fiscalUtils'
import { RequiredMark } from './FiscalRequired'

type FiscalEntryItemsProps = {
  items: FiscalDraftItem[]
  products: FiscalProduct[]
  onChange: Dispatch<SetStateAction<FiscalDraftItem[]>>
}

export function FiscalEntryItems({ items, products, onChange }: FiscalEntryItemsProps) {
  const activeProducts = products.filter((product) => product.is_active)

  function updateItem(index: number, field: keyof FiscalDraftItem, value: string) {
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    )
  }

  return (
    <div className="space-y-3">
      <p>Produtos recebidos — cadastrar a nota ainda não altera o estoque.</p>

      {items.map((item, index) => {
        const product = activeProducts.find((option) => option.id === item.product_id)
        const unit = product ? formatUnit(product.unit_of_measure) : ''

        return (
          <div className="fiscal-form-grid" key={index}>
            <label>
              <span>
                Produto
                <RequiredMark />
              </span>
              <select
                required
                aria-required="true"
                value={item.product_id}
                onChange={(event) => updateItem(index, 'product_id', event.target.value)}
              >
                <option value="">Selecione</option>

                {activeProducts.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({formatUnit(option.unit_of_measure)})
                  </option>
                ))}
              </select>
            </label>

            {(['quantity', 'unit_price'] as const).map((field) => (
              <label key={field}>
                <span>
                  {field === 'quantity'
                    ? `Quantidade${unit ? ` (${unit})` : ''}`
                    : `Valor unitário${unit ? ` por ${unit}` : ''}`}
                  <RequiredMark />
                </span>

                <input
                  required
                  aria-required="true"
                  type="number"
                  min={field === 'quantity' ? '0.001' : '0'}
                  step={field === 'quantity' ? '0.001' : '0.01'}
                  title={
                    field === 'quantity' && unit
                      ? `Quantidade em ${FISCAL_UNIT_NAMES[unit] || unit}`
                      : undefined
                  }
                  value={item[field]}
                  onChange={(event) => updateItem(index, field, event.target.value)}
                />
              </label>
            ))}

            <button
              className="secondary-button"
              disabled={items.length === 1}
              type="button"
              aria-label={`Remover item ${index + 1}`}
              onClick={() =>
                onChange((current) => current.filter((_, itemIndex) => itemIndex !== index))
              }
            >
              Remover item
            </button>
          </div>
        )
      })}

      <button
        className="secondary-button"
        disabled={items.length >= 100}
        type="button"
        onClick={() => onChange((current) => [...current, createEmptyFiscalItem()])}
      >
        Adicionar produto
      </button>
    </div>
  )
}
