import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type PrintableQuote = {
  id: string
  customer_name: string
  status: string
  created_at: string
  valid_until: string
  total_amount: string
  items: {
    product_name: string
    quantity: string
    unit_price: string
  }[]
}

type QuotePrintAreaProps = {
  quote: PrintableQuote
  organization: Record<string, string | null>
  onDone: () => void
}

function money(value: string): string {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function dateOnly(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function quantity(value: string): string {
  return Number(value).toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
  })
}

export function QuotePrintArea({ quote, organization, onDone }: QuotePrintAreaProps) {
  useEffect(() => {
    window.addEventListener('afterprint', onDone, { once: true })
    const frame = window.requestAnimationFrame(() => window.print())

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', onDone)
    }
  }, [quote.id, onDone])

  return createPortal(
    <div className="quote-print-root">
      <article className="quote-print-page">
        <header className="quote-print-header">
          <div>
            <p className="quote-print-eyebrow">PROPOSTA COMERCIAL</p>
            <h1>Orçamento</h1>
            <p>Nº {quote.id.slice(0, 8)}</p>
          </div>

          <div className="quote-print-company">
            <strong>{organization.name || 'Empresa não identificada'}</strong>
            {organization.document && <span>CNPJ: {organization.document}</span>}
            {organization.phone && <span>{organization.phone}</span>}
          </div>
        </header>

        <section className="quote-print-details">
          <div>
            <span>Cliente</span>
            <strong>{quote.customer_name}</strong>
          </div>
          <div>
            <span>Emissão</span>
            <strong>{new Date(quote.created_at).toLocaleDateString('pt-BR')}</strong>
          </div>
          <div>
            <span>Válido até</span>
            <strong>{dateOnly(quote.valid_until)}</strong>
          </div>
        </section>

        <table className="quote-print-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Quantidade</th>
              <th>Preço unitário</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, index) => (
              <tr key={`${item.product_name}-${index}`}>
                <td>{item.product_name}</td>
                <td>{quantity(item.quantity)}</td>
                <td>{money(item.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="quote-print-total">
          <span>Total do orçamento</span>
          <strong>{money(quote.total_amount)}</strong>
        </div>

        <footer className="quote-print-footer">
          <p>Identificador completo: {quote.id}</p>
          <p>Esta proposta comercial não é um documento fiscal.</p>
        </footer>
      </article>
    </div>,
    window.document.body,
  )
}
