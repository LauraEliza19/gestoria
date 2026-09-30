import type { FormEvent } from 'react'
import type { SupplierFormState } from './fiscalTypes'

type FiscalSupplierFormProps = {
  form: SupplierFormState
  busy: boolean
  onChange: (form: SupplierFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function FiscalSupplierForm({ form, busy, onChange, onSubmit }: FiscalSupplierFormProps) {
  return (
    <details className="rounded-lg border border-line bg-white">
      <summary className="cursor-pointer rounded-lg px-4 py-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
        Cadastrar fornecedor
      </summary>

      <form
        className="grid grid-cols-1 items-end gap-4 border-t border-line p-4 md:grid-cols-2"
        onSubmit={onSubmit}
      >
        <label className="form-label min-w-0">
          Nome
          <input
            className="form-input"
            required
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
          CPF/CNPJ (somente números)
          <input
            className="form-input"
            required
            inputMode="numeric"
            pattern="[0-9]{11}|[0-9]{14}"
            maxLength={14}
            placeholder="Digite 11 ou 14 dígitos"
            value={form.document}
            onChange={(event) =>
              onChange({
                ...form,
                document: event.target.value.replace(/\D/g, ''),
              })
            }
          />
        </label>

        <div className="flex justify-end md:col-span-2">
          <button
            className="secondary-button w-full disabled:cursor-wait disabled:opacity-70 sm:w-auto"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Aguarde...' : 'Salvar fornecedor'}
          </button>
        </div>
      </form>
    </details>
  )
}
