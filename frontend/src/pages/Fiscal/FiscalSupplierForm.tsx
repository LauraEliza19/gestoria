import { useState } from 'react'
import { SaveButton, SavingForm } from '../../components/forms/FormActions'
import type { FormEvent } from 'react'
import type { SupplierFormState } from './fiscalTypes'
import { maskPhoneInput, maskTaxIdInput, onlyDigits, supplierFormErrors } from './fiscalUtils'
import { RequiredMark } from './FiscalRequired'

type FiscalSupplierFormProps = {
  form: SupplierFormState
  busy: boolean
  saving: boolean
  onAttempt: () => void
  onChange: (form: SupplierFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  error?: string
  autoFocus?: boolean
  onCancel?: () => void
}

type TouchedField = 'document' | 'phone' | 'email'

// Campos do cadastro rápido de fornecedor, usado dentro da nota de entrada.
export function FiscalSupplierForm({
  form,
  busy,
  saving,
  onAttempt,
  onChange,
  onSubmit,
  error = '',
  autoFocus = false,
  onCancel,
}: FiscalSupplierFormProps) {
  const [touched, setTouched] = useState<Partial<Record<TouchedField, boolean>>>({})
  const errors = supplierFormErrors(form)
  const canSubmit = Object.keys(errors).length === 0

  const documentError = errors.document || ''
  const showDocumentError =
    Boolean(touched.document) && Boolean(form.document) && Boolean(documentError)
  const showPhoneError = Boolean(touched.phone) && Boolean(errors.phone)
  const showEmailError = Boolean(touched.email) && Boolean(errors.email)

  function markTouched(field: TouchedField) {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (busy) {
      event.preventDefault()
      return
    }

    onAttempt()
    setTouched({ document: true, phone: true, email: true })

    if (!canSubmit) {
      event.preventDefault()
      return
    }

    onSubmit(event)
  }

  return (
    <SavingForm
      className="grid grid-cols-1 items-start gap-4 md:grid-cols-2"
      saving={saving}
      noValidate
      onSubmit={handleSubmit}
    >
      <label className="form-label min-w-0">
        <span>
          Nome
          <RequiredMark />
        </span>
        <input
          className="form-input"
          required
          aria-required="true"
          autoFocus={autoFocus}
          maxLength={160}
          placeholder="Nome ou razão social"
          value={form.name}
          onChange={(event) =>
            onChange({
              ...form,
              name: event.target.value,
            })
          }
        />
      </label>

      <label className="form-label min-w-0">
        <span>
          CPF/CNPJ
          <RequiredMark />
        </span>
        <input
          className="form-input"
          required
          aria-required="true"
          aria-invalid={showDocumentError}
          aria-describedby="fiscal-supplier-document-hint"
          inputMode="numeric"
          maxLength={18}
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
          value={maskTaxIdInput(form.document)}
          onBlur={() => markTouched('document')}
          onChange={(event) =>
            onChange({
              ...form,
              document: onlyDigits(event.target.value).slice(0, 14),
            })
          }
        />
        <small
          id="fiscal-supplier-document-hint"
          className={showDocumentError ? 'fiscal-field-error' : 'fiscal-field-hint'}
          role={showDocumentError ? 'alert' : undefined}
        >
          {showDocumentError
            ? documentError
            : `CPF com 11 dígitos ou CNPJ com 14 dígitos (${onlyDigits(form.document).length} informados).`}
        </small>
      </label>

      <label className="form-label min-w-0">
        <span>Telefone</span>
        <input
          className="form-input"
          type="tel"
          aria-invalid={showPhoneError}
          aria-describedby="fiscal-supplier-phone-hint"
          inputMode="tel"
          maxLength={15}
          placeholder="(00) 00000-0000"
          value={maskPhoneInput(form.phone)}
          onBlur={() => markTouched('phone')}
          onChange={(event) =>
            onChange({
              ...form,
              phone: onlyDigits(event.target.value).slice(0, 11),
            })
          }
        />
        <small
          id="fiscal-supplier-phone-hint"
          className={showPhoneError ? 'fiscal-field-error' : 'fiscal-field-hint'}
          role={showPhoneError ? 'alert' : undefined}
        >
          {showPhoneError ? errors.phone : 'Opcional. Informe com DDD.'}
        </small>
      </label>

      <label className="form-label min-w-0">
        <span>E-mail</span>
        <input
          className="form-input"
          type="email"
          aria-invalid={showEmailError}
          aria-describedby="fiscal-supplier-email-hint"
          inputMode="email"
          maxLength={254}
          placeholder="compras@fornecedor.com.br"
          value={form.email ?? ''}
          onBlur={() => markTouched('email')}
          onChange={(event) =>
            onChange({
              ...form,
              email: event.target.value,
            })
          }
        />
        <small
          id="fiscal-supplier-email-hint"
          className={showEmailError ? 'fiscal-field-error' : 'fiscal-field-hint'}
          role={showEmailError ? 'alert' : undefined}
        >
          {showEmailError ? errors.email : 'Opcional.'}
        </small>
      </label>

      {error && (
        <div className="fiscal-feedback fiscal-feedback-error mb-0 md:col-span-2" role="alert">
          <strong>Não foi possível salvar o fornecedor</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end md:col-span-2">
        {onCancel && (
          <button
            className="secondary-button disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={saving}
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}

        <SaveButton
          className="primary-button disabled:cursor-not-allowed disabled:opacity-70"
          saving={saving}
          disabled={busy || !canSubmit}
        >
          Salvar fornecedor
        </SaveButton>
      </div>
    </SavingForm>
  )
}
