import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SupplierFormState } from './fiscalTypes'
import { maskTaxIdInput, onlyDigits, taxIdError } from './fiscalUtils'
import { RequiredMark } from './FiscalRequired'

type FiscalSupplierFormProps = {
  form: SupplierFormState
  busy: boolean
  onChange: (form: SupplierFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function FiscalSupplierForm({ form, busy, onChange, onSubmit }: FiscalSupplierFormProps) {
  const [touched, setTouched] = useState(false)
  const documentError = taxIdError(form.document)
  const showDocumentError = touched && Boolean(form.document) && Boolean(documentError)
  const canSubmit = Boolean(form.name.trim()) && !documentError

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setTouched(true)

    if (!canSubmit) {
      event.preventDefault()
      return
    }

    onSubmit(event)
  }

  return (
    <details className="rounded-lg border border-line bg-white">
      <summary className="cursor-pointer rounded-lg px-4 py-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
        Cadastrar fornecedor
      </summary>

      <form
        className="grid grid-cols-1 items-start gap-4 border-t border-line p-4 md:grid-cols-2"
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
            onBlur={() => setTouched(true)}
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

        <div className="flex justify-end md:col-span-2">
          <button
            className="secondary-button w-full disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            disabled={busy || !canSubmit}
            type="submit"
          >
            {busy ? 'Aguarde...' : 'Salvar fornecedor'}
          </button>
        </div>
      </form>
    </details>
  )
}
