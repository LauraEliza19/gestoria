import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type PrintableQuote = {
  id: string
  customer_name: string
  status: string
  created_at: string
  valid_until: string
  gross_amount: string
  general_discount_percent: string
  discount_amount: string
  total_amount: string
  payment_terms: 'cash' | 'installments'
  installment_count: number
  installment_amount: string
  items: {
    product_code: string
    product_name: string
    quantity: string
    unit_price: string
    discount_percent: string
    total_amount: string
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

function percentage(value: string): string {
  return `${Number(value).toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  })}%`
}

export function QuotePrintArea({ quote, organization, onDone }: QuotePrintAreaProps) {
  useEffect(() => {
    window.addEventListener('afterprint', onDone, {
      once: true,
    })
    const frame = window.requestAnimationFrame(() => window.print())

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', onDone)
    }
  }, [quote.id, onDone])

  const paymentDescription =
    quote.payment_terms === 'cash'
      ? 'À vista'
      : `${quote.installment_count}x de ${money(quote.installment_amount)}`

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

          <div>
            <span>Pagamento</span>
            <strong>{paymentDescription}</strong>
          </div>
        </section>

        <table className="quote-print-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Produto</th>
              <th className="quote-print-number">Quantidade</th>
              <th className="quote-print-number">Preço unitário</th>
              <th className="quote-print-number">Desconto</th>
              <th className="quote-print-number">Total</th>
            </tr>
          </thead>

          <tbody>
            {quote.items.map((item) => (
              <tr key={item.product_code}>
                <td>{item.product_code}</td>
                <td>{item.product_name}</td>

                <td className="quote-print-number">{quantity(item.quantity)}</td>

                <td className="quote-print-number">{money(item.unit_price)}</td>

                <td className="quote-print-number">{percentage(item.discount_percent)}</td>

                <td className="quote-print-number">{money(item.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="quote-print-summary">
          <div className="quote-print-summary-row">
            <span>Valor bruto</span>
            <strong>{money(quote.gross_amount)}</strong>
          </div>

          <div className="quote-print-summary-row">
            <span>Descontos totais</span>
            <strong>− {money(quote.discount_amount)}</strong>
          </div>

          {Number(quote.general_discount_percent) > 0 && (
            <div className="quote-print-summary-row">
              <span>{quote.payment_terms === 'cash' ? 'Desconto à vista' : 'Desconto geral'}</span>

              <strong>{percentage(quote.general_discount_percent)}</strong>
            </div>
          )}

          <div className="quote-print-summary-row quote-print-summary-total">
            <span>Total do orçamento</span>
            <strong>{money(quote.total_amount)}</strong>
          </div>

          <p className="quote-print-payment-note">Condição de pagamento: {paymentDescription}</p>
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
