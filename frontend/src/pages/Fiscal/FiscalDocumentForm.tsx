import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type {
  FiscalDraftItem,
  FiscalFormState,
  FiscalOrder,
  FiscalProduct,
  FiscalSupplier,
  SupplierFormState,
} from './fiscalTypes'
import { formatFiscalMoney } from './fiscalUtils'
import { FiscalItems } from './FiscalItems'
import { FiscalEntryItems } from './FiscalEntryItems'
import { FiscalSupplierForm } from './FiscalSupplierForm'

type FiscalDocumentFormProps = {
  form: FiscalFormState
  setForm: Dispatch<SetStateAction<FiscalFormState>>
  orders: FiscalOrder[]
  suppliers: FiscalSupplier[]
  products: FiscalProduct[]
  draftItems: FiscalDraftItem[]
  setDraftItems: Dispatch<SetStateAction<FiscalDraftItem[]>>
  supplierForm: SupplierFormState
  setSupplierForm: Dispatch<SetStateAction<SupplierFormState>>
  busy: boolean
  loading: boolean
  isOccupied: (orderId: string) => boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCreateSupplier: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}

export function FiscalDocumentForm({
  form,
  setForm,
  orders,
  suppliers,
  products,
  draftItems,
  setDraftItems,
  supplierForm,
  setSupplierForm,
  busy,
  loading,
  isOccupied,
  onSubmit,
  onCreateSupplier,
  onClose,
}: FiscalDocumentFormProps) {
  const chosenOrder = orders.find((order) => order.id === form.order_id)

  return (
    <section className="page-card space-y-4">
      <form className="fiscal-form space-y-4" onSubmit={onSubmit}>
        <h2>Novo registro fiscal</h2>

        <div className="fiscal-form-grid">
          <label>
            Tipo
            <select
              value={form.document_type}
              onChange={(event) =>
                setForm({
                  ...form,
                  document_type: event.target.value as 'saida' | 'entrada',
                })
              }
            >
              <option value="saida">Saída — pedido de venda</option>
              <option value="entrada">Entrada — fornecedor</option>
            </select>
          </label>

          {form.document_type === 'saida' ? (
            <label>
              Pedido obrigatório
              <select
                required
                value={form.order_id}
                onChange={(event) =>
                  setForm({
                    ...form,
                    order_id: event.target.value,
                  })
                }
              >
                <option value="">Selecione o pedido</option>

                {orders
                  .filter((order) => order.status !== 'cancelled')
                  .map((order) => (
                    <option disabled={isOccupied(order.id)} key={order.id} value={order.id}>
                      {order.id.slice(0, 8)} · {order.customer_name} ·{' '}
                      {formatFiscalMoney(order.total_amount)}
                      {isOccupied(order.id) ? ' · já possui nota ativa' : ''}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <label>
              Fornecedor obrigatório
              <select
                required
                value={form.supplier_id}
                onChange={(event) =>
                  setForm({
                    ...form,
                    supplier_id: event.target.value,
                  })
                }
              >
                <option value="">Selecione o fornecedor</option>

                {suppliers
                  .filter((supplier) => supplier.is_active)
                  .map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} · {supplier.document}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <label>
            Modelo
            <select
              value={form.model}
              onChange={(event) =>
                setForm({
                  ...form,
                  model: event.target.value,
                })
              }
            >
              <option value="55">55 — NF-e</option>
              <option value="65">65 — NFC-e</option>
              <option value="NFS-e">NFS-e</option>
            </select>
          </label>

          {(
            ['number', 'series', 'issue_date', 'cfop', 'operation_nature', 'access_key'] as const
          ).map((field) => (
            <label key={field}>
              {
                {
                  number: 'Número',
                  series: 'Série',
                  issue_date: 'Data de emissão informada',
                  cfop: 'CFOP',
                  operation_nature: 'Natureza da operação',
                  access_key: 'Chave de acesso (44 dígitos)',
                }[field]
              }

              <input
                type={field === 'issue_date' ? 'date' : 'text'}
                value={form[field]}
                required={['number', 'series', 'issue_date'].includes(field)}
                maxLength={
                  field === 'access_key'
                    ? 44
                    : field === 'number'
                      ? 30
                      : field === 'series'
                        ? 20
                        : field === 'cfop'
                          ? 10
                          : 160
                }
                pattern={field === 'access_key' ? '[0-9]{44}' : undefined}
                onChange={(event) =>
                  setForm({
                    ...form,
                    [field]: event.target.value,
                  })
                }
              />
            </label>
          ))}
        </div>

        {form.document_type === 'saida' && chosenOrder && (
          <div className="info-note">
            <p>
              Destinatário: <strong>{chosenOrder.customer_name}</strong>
              {' · '}Total do pedido: <strong>{formatFiscalMoney(chosenOrder.total_amount)}</strong>
            </p>

            <FiscalItems items={chosenOrder.items} />

            <p>Os valores e itens serão conferidos e copiados do pedido pelo servidor.</p>
          </div>
        )}

        {form.document_type === 'entrada' && (
          <FiscalEntryItems items={draftItems} products={products} onChange={setDraftItems} />
        )}

        <div className="flex gap-3">
          <button className="primary-button" disabled={busy || loading} type="submit">
            Registrar documento
          </button>

          <button className="secondary-button" type="button" onClick={onClose}>
            Fechar formulário
          </button>
        </div>
      </form>

      {form.document_type === 'entrada' && (
        <FiscalSupplierForm
          form={supplierForm}
          busy={busy}
          onChange={setSupplierForm}
          onSubmit={onCreateSupplier}
        />
      )}
    </section>
  )
}
