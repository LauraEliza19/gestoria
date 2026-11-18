import { useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { X } from 'lucide-react'
import type { SupplierFormState } from './fiscalTypes'
import { UNSAVED_FORM_MESSAGE, isSupplierDraftDirty } from './fiscalUtils'
import { FiscalSupplierForm } from './FiscalSupplierForm'

type FiscalSupplierDialogProps = {
  open: boolean
  form: SupplierFormState
  busy: boolean
  saving: boolean
  error?: string
  onAttempt: () => void
  onChange: (form: SupplierFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}

// Cadastro rápido de fornecedor sem sair da nota de entrada em preenchimento.
export function FiscalSupplierDialog({ open, ...props }: FiscalSupplierDialogProps) {
  return open ? <SupplierDialogContent {...props} /> : null
}

function SupplierDialogContent({
  form,
  busy,
  saving,
  error = '',
  onAttempt,
  onChange,
  onSubmit,
  onClose,
}: Omit<FiscalSupplierDialogProps, 'open'>) {
  const closeRef = useRef(requestClose)

  // Fecha somente quando não há salvamento em andamento nem dados a descartar.
  function requestClose() {
    if (saving) return
    if (isSupplierDraftDirty(form) && !window.confirm(UNSAVED_FORM_MESSAGE)) return
    onClose()
  }

  useEffect(() => {
    closeRef.current = requestClose
  })

  useEffect(() => {
    const previousFocus = window.document.activeElement as HTMLElement | null
    const previousOverflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeRef.current()
      }
    }

    window.addEventListener('keydown', handleKey)

    return () => {
      window.removeEventListener('keydown', handleKey)
      window.document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return (
    <div
      className="fiscal-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose()
        }
      }}
    >
      <div
        className="fiscal-modal fiscal-supplier-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fiscal-supplier-dialog-title"
        aria-describedby="fiscal-supplier-dialog-description"
      >
        <header className="fiscal-modal-header">
          <h2 id="fiscal-supplier-dialog-title">Novo fornecedor</h2>
          <button
            className="detail-close"
            type="button"
            aria-label="Fechar cadastro de fornecedor"
            title="Fechar (Esc)"
            disabled={saving}
            onClick={requestClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="fiscal-modal-body">
          <p className="text-sm text-muted" id="fiscal-supplier-dialog-description">
            Cadastre sem sair da nota: ao salvar, o fornecedor já fica selecionado. Para consultar
            ou editar depois, use Cadastros → Fornecedores.
          </p>

          <FiscalSupplierForm
            form={form}
            busy={busy}
            saving={saving}
            error={error}
            autoFocus
            onAttempt={onAttempt}
            onChange={onChange}
            onSubmit={onSubmit}
            onCancel={requestClose}
          />
        </div>
      </div>
    </div>
  )
}
