import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FiscalDanfe } from './FiscalDanfe'
import type { FiscalDocument, FiscalOrganization } from './fiscalTypes'

type FiscalPrintAreaProps = {
  documents: FiscalDocument[]
  organization?: FiscalOrganization
  onDone: () => void
}

export function FiscalPrintArea({ documents, organization, onDone }: FiscalPrintAreaProps) {
  useEffect(() => {
    if (documents.length === 0) {
      return
    }

    window.addEventListener('afterprint', onDone, { once: true })
    const frame = window.requestAnimationFrame(() => window.print())

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', onDone)
    }
  }, [documents, onDone])

  if (documents.length === 0) {
    return null
  }

  return createPortal(
    <div className="fiscal-print-root" aria-hidden="true">
      {documents.map((document) => (
        <div className="fiscal-print-page" key={document.id}>
          <FiscalDanfe document={document} organization={organization} />
        </div>
      ))}
    </div>,
    window.document.body,
  )
}
