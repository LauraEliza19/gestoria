const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const page = read('src/pages/Quotes/QuotesPage.tsx')
const printArea = read('src/pages/Quotes/QuotePrintArea.tsx')
const styles = read('src/styles/tailwind.css')

test('quote form searches products by name or code', () => {
  assert.match(page, /type ProductSearchField = 'name' \| 'code'/)
  assert.match(page, /productSearchField/)
  assert.match(page, /Digite o nome do produto/)
  assert.match(page, /PRO-000001/)
  assert.match(page, /product\.code/)
})

test('quote form sends commercial conditions to the backend', () => {
  assert.match(page, /general_discount_percent:\s*Number\(/)
  assert.match(page, /payment_terms:\s*paymentTerms/)
  assert.match(page, /installment_count:/)
  assert.match(page, /discount_percent:\s*Number\(item\.discountPercent\)/)
})

test('quote preview exposes discounts and installments', () => {
  assert.match(page, /Desconto à vista/)
  assert.match(page, /Crediário parcelado/)
  assert.match(page, /Quantidade de parcelas/)
  assert.match(page, /Valor bruto/)
  assert.match(page, /Descontos totais/)
  assert.match(page, /estimatedAmounts\.installmentAmount/)
})

test('quote review uses values confirmed by the backend', () => {
  assert.match(page, /reviewedQuote\.gross_amount/)
  assert.match(page, /reviewedQuote\.discount_amount/)
  assert.match(page, /reviewedQuote\.total_amount/)
  assert.match(page, /item\.discount_percent/)
  assert.match(page, /item\.total_amount/)
})

test('quote PDF includes commercial conditions', () => {
  assert.match(printArea, /product_code/)
  assert.match(printArea, /discount_percent/)
  assert.match(printArea, /general_discount_percent/)
  assert.match(printArea, /installment_amount/)
  assert.match(printArea, /Condição de pagamento/)
  assert.match(printArea, /Total do orçamento/)
})

test('quote PDF styles support financial summary', () => {
  assert.match(styles, /\.quote-print-number/)
  assert.match(styles, /\.quote-print-summary/)
  assert.match(styles, /\.quote-print-summary-row/)
  assert.match(styles, /\.quote-print-summary-total/)
  assert.match(styles, /@media print/)
})
