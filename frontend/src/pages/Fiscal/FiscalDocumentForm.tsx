import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type {
  FiscalDraftItem,
  FiscalFormState,
  FiscalOrder,
  FiscalProduct,
  FiscalSupplier,
  SupplierFormState,
} from './fiscalTypes'
import {
  ACCESS_KEY_LENGTH,
  CFOP_EXAMPLES,
  OPERATION_NATURE_EXAMPLES,
  fiscalDocumentFormErrors,
  formatFiscalMoney,
  formatTaxId,
  onlyDigits,
} from './fiscalUtils'
import { FiscalItems } from './FiscalItems'
import { FiscalEntryItems } from './FiscalEntryItems'
import { FiscalSupplierForm } from './FiscalSupplierForm'
import { RequiredLegend, RequiredMark } from './FiscalRequired'

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
  dirty?: boolean
  openedAt?: number
  isOccupied: (orderId: string) => boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCreateSupplier: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}

type TextField = 'number' | 'series' | 'issue_date' | 'cfop' | 'operation_nature' | 'access_key'

const FIELD_LABELS: Record<TextField, string> = {
  number: 'Número',
  series: 'Série',
  issue_date: 'Data de emissão informada',
  cfop: 'CFOP',
  operation_nature: 'Natureza da operação',
  access_key: 'Chave de acesso (44 dígitos)',
}

const FIELD_PLACEHOLDERS: Record<TextField, string | undefined> = {
  number: 'Ex.: 1234',
  series: 'Ex.: 1',
  issue_date: undefined,
  cfop: 'Ex.: 5102',
  operation_nature: 'Ex.: Venda de mercadoria',
  access_key: 'Somente números — 44 dígitos',
}

const FIELD_MAX_LENGTH: Record<TextField, number> = {
  number: 30,
  series: 20,
  issue_date: 10,
  cfop: 10,
  operation_nature: 160,
  access_key: ACCESS_KEY_LENGTH,
}

const REQUIRED_FIELDS: TextField[] = ['number', 'series', 'issue_date']

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
  dirty = false,
  openedAt = 0,
  isOccupied,
  onSubmit,
  onCreateSupplier,
  onClose,
}: FiscalDocumentFormProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)

  const chosenOrder = orders.find((order) => order.id === form.order_id)
  const availableOrders = orders.filter(
    (order) => order.status !== 'cancelled' && !isOccupied(order.id),
  )
  const errors = fiscalDocumentFormErrors(form, draftItems)
  const hasErrors = Object.keys(errors).length > 0

  // Ao abrir (ou reabrir) o formulário, rola até ele e move o foco para o título.
  useEffect(() => {
    const section = sectionRef.current

    if (!section) {
      return
    }

    if (typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    headingRef.current?.focus({ preventScroll: true })
  }, [openedAt])

  function showError(field: string) {
    return (submitted || touched[field]) && errors[field as keyof typeof errors]
  }

  function markTouched(field: string) {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitted(true)

    if (hasErrors) {
      event.preventDefault()
      return
    }

    onSubmit(event)
  }

  return (
    <section
      ref={sectionRef}
      id="fiscal-new-document"
      className="page-card fiscal-new-document space-y-4"
      aria-labelledby="fiscal-new-document-title"
    >
      <div className="fiscal-form-opened" role="status">
        <strong>Formulário de nova nota aberto.</strong>
        <span>
          Preencha os campos obrigatórios (*) e clique em “Registrar documento”.
          {dirty ? ' Há alterações ainda não salvas.' : ''}
        </span>
      </div>

      <form className="fiscal-form space-y-4" noValidate onSubmit={handleSubmit}>
        <h2 id="fiscal-new-document-title" ref={headingRef} tabIndex={-1}>
          Novo registro fiscal
        </h2>

        <RequiredLegend />

        <div className="fiscal-form-grid">
          <label>
            <span>
              Tipo
              <RequiredMark />
            </span>
            <select
              required
              aria-required="true"
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
              <span>
                Pedido vinculado
                <RequiredMark />
              </span>
              <select
                required
                aria-required="true"
                aria-invalid={Boolean(showError('order_id'))}
                aria-describedby={showError('order_id') ? 'fiscal-error-order_id' : undefined}
                value={form.order_id}
                onBlur={() => markTouched('order_id')}
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
              {showError('order_id') && (
                <small className="fiscal-field-error" id="fiscal-error-order_id">
                  {errors.order_id}
                </small>
              )}
              {availableOrders.length === 0 && (
                <small className="font-normal text-muted">
                  Nenhum pedido disponível. Crie um pedido em{' '}
                  <Link className="font-bold text-signal" to="/pedidos/novo">
                    Pedidos → Novo pedido
                  </Link>{' '}
                  e volte aqui.
                </small>
              )}
            </label>
          ) : (
            <label>
              <span>
                Fornecedor
                <RequiredMark />
              </span>
              <select
                required
                aria-required="true"
                aria-invalid={Boolean(showError('supplier_id'))}
                aria-describedby={showError('supplier_id') ? 'fiscal-error-supplier_id' : undefined}
                value={form.supplier_id}
                onBlur={() => markTouched('supplier_id')}
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
                      {supplier.name} · {formatTaxId(supplier.document)}
                    </option>
                  ))}
              </select>
              {showError('supplier_id') && (
                <small className="fiscal-field-error" id="fiscal-error-supplier_id">
                  {errors.supplier_id}
                </small>
              )}
            </label>
          )}

          <label>
            <span>
              Modelo
              <RequiredMark />
            </span>
            <select
              required
              aria-required="true"
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
          ).map((field) => {
            const required = REQUIRED_FIELDS.includes(field)
            const error = showError(field)
            const hintId = `fiscal-hint-${field}`
            const errorId = `fiscal-error-${field}`
            const describedBy =
              [
                field === 'cfop' || field === 'operation_nature' || field === 'access_key'
                  ? hintId
                  : '',
                error ? errorId : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined

            return (
              <label
                key={field}
                className={
                  field === 'access_key'
                    ? 'fiscal-field-wide'
                    : field === 'operation_nature'
                      ? 'fiscal-field-half'
                      : undefined
                }
              >
                <span>
                  {FIELD_LABELS[field]}
                  {required && <RequiredMark />}
                </span>

                <input
                  type={field === 'issue_date' ? 'date' : 'text'}
                  value={form[field]}
                  required={required}
                  aria-required={required}
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy}
                  placeholder={FIELD_PLACEHOLDERS[field]}
                  maxLength={FIELD_MAX_LENGTH[field]}
                  inputMode={field === 'access_key' || field === 'cfop' ? 'numeric' : undefined}
                  pattern={field === 'access_key' ? '[0-9]{44}' : undefined}
                  list={
                    field === 'cfop'
                      ? 'fiscal-cfop-examples'
                      : field === 'operation_nature'
                        ? 'fiscal-nature-examples'
                        : undefined
                  }
                  className={field === 'access_key' ? 'fiscal-access-key-input' : undefined}
                  onBlur={() => markTouched(field)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      [field]:
                        field === 'access_key'
                          ? onlyDigits(event.target.value).slice(0, ACCESS_KEY_LENGTH)
                          : event.target.value,
                    })
                  }
                />

                {field === 'cfop' && (
                  <small className="fiscal-field-hint" id={hintId}>
                    Ex.: 5102 (venda dentro do estado), 6102 (venda para outro estado), 1102 (compra
                    para revenda).
                  </small>
                )}

                {field === 'operation_nature' && (
                  <small className="fiscal-field-hint" id={hintId}>
                    Ex.: Venda de mercadoria, Compra para comercialização, Devolução de compra.
                  </small>
                )}

                {field === 'access_key' && (
                  <small className="fiscal-field-hint" id={hintId}>
                    {form.access_key.length}/{ACCESS_KEY_LENGTH} dígitos · opcional no registro
                  </small>
                )}

                {error && (
                  <small className="fiscal-field-error" id={errorId}>
                    {errors[field]}
                  </small>
                )}
              </label>
            )
          })}
        </div>

        <datalist id="fiscal-cfop-examples">
          {CFOP_EXAMPLES.map((example) => (
            <option key={example.code} value={example.code}>
              {example.label}
            </option>
          ))}
        </datalist>

        <datalist id="fiscal-nature-examples">
          {OPERATION_NATURE_EXAMPLES.map((example) => (
            <option key={example} value={example} />
          ))}
        </datalist>

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

        {form.document_type === 'entrada' && submitted && errors.items && (
          <p className="fiscal-field-error" role="alert">
            {errors.items}
          </p>
        )}

        {submitted && hasErrors && (
          <p className="fiscal-field-error" role="alert">
            Revise os campos destacados antes de registrar o documento.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
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
