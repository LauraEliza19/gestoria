import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { FiscalDocument, FiscalOrganization } from './fiscalTypes'
import { fiscalParties, formatFiscalDateTime, formatFiscalDate, formatTaxId } from './fiscalUtils'

type FiscalModalProps = {
  title: string
  document: FiscalDocument
  organization?: FiscalOrganization
  wide?: boolean
  showContext?: boolean
  footer?: ReactNode
  children: ReactNode
  onClose: () => void
}

export function FiscalModal({
  title,
  document,
  organization,
  wide = false,
  showContext = true,
  footer,
  children,
  onClose,
}: FiscalModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef(onClose)
  const { emitter, recipient } = fiscalParties(document, organization)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = window.document.activeElement as HTMLElement | null
    const previousOverflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

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
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`fiscal-modal ${wide ? 'fiscal-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fiscal-modal-title"
        tabIndex={-1}
      >
        <header className="fiscal-modal-header">
          <h2 id="fiscal-modal-title">{title}</h2>
          <button className="detail-close" type="button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="fiscal-modal-body">
          {showContext && (
            <div className="fiscal-modal-context">
              <span>
                Número - Série
                <strong>
                  {document.number} - {document.series}
                </strong>
              </span>
              <span>
                Emissão
                <strong>{formatFiscalDate(document.issue_date)}</strong>
              </span>
              <span className="md:col-span-2">
                Chave de acesso
                <strong className="font-mono">{document.access_key || 'Não informada'}</strong>
              </span>
              <span>
                Emitente
                <strong>{emitter.name}</strong>
                <small>{formatTaxId(emitter.document)}</small>
              </span>
              <span>
                Destinatário
                <strong>{recipient.name}</strong>
                <small>{formatTaxId(recipient.document)}</small>
              </span>
              <span>
                Protocolo de autorização
                <strong>{document.authorization_protocol || 'Sem protocolo'}</strong>
              </span>
              <span>
                Última atualização
                <strong>{formatFiscalDateTime(document.updated_at || document.created_at)}</strong>
              </span>
            </div>
          )}

          {children}
        </div>

        {footer && <footer className="fiscal-modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}
