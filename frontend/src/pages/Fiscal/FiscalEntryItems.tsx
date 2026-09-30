import type { Dispatch, SetStateAction } from 'react'
import type { FiscalDraftItem, FiscalProduct } from './fiscalTypes'
import { createEmptyFiscalItem } from './fiscalUtils'

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

      {items.map((item, index) => (
        <div className="fiscal-form-grid" key={index}>
          <label>
            Produto
            <select
              required
              value={item.product_id}
              onChange={(event) => updateItem(index, 'product_id', event.target.value)}
            >
              <option value="">Selecione</option>

              {activeProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          {(['quantity', 'unit_price'] as const).map((field) => (
            <label key={field}>
              {field === 'quantity' ? 'Quantidade' : 'Valor unitário'}

              <input
                required
                type="number"
                min={field === 'quantity' ? '0.001' : '0'}
                step={field === 'quantity' ? '0.001' : '0.01'}
                value={item[field]}
                onChange={(event) => updateItem(index, field, event.target.value)}
              />
            </label>
          ))}

          <button
            className="secondary-button"
            disabled={items.length === 1}
            type="button"
            onClick={() =>
              onChange((current) => current.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            Remover item
          </button>
        </div>
      ))}

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
