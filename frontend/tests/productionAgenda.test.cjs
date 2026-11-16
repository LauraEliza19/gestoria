const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const agenda = read('src/pages/FactoryMode/ProductionAgenda.tsx')
const factory = read('src/pages/FactoryMode/FactoryModePage.tsx')
const orders = read('src/pages/Orders/OrdersPage.tsx')

test('production agenda filters the selected day before paginating', () => {
  assert.match(agenda, /promised_from: promisedFrom/)
  assert.match(agenda, /promised_to: promisedTo/)
  assert.match(agenda, /sort: 'promised_at'/)
  assert.match(agenda, /page: String\(page\)/)
  assert.match(agenda, /page_size: String\(agendaPageSize\)/)
  assert.match(agenda, /\[page, selectedDate\]/)
})

test('production agenda provides daily navigation and real pagination', () => {
  assert.match(agenda, /Mostrar dia anterior/)
  assert.match(agenda, /Mostrar próximo dia/)
  assert.match(agenda, />\s*Hoje\s*</)
  assert.match(agenda, /aria-label="Paginação da agenda"/)
  assert.match(agenda, /changePage\(page - 1\)/)
  assert.match(agenda, /changePage\(page \+ 1\)/)
  assert.match(agenda, /Math\.ceil\(total \/ agendaPageSize\)/)
})

test('production agenda keeps four metrics in one desktop row', () => {
  assert.match(agenda, /xl:!grid-cols-4/)
  assert.match(agenda, /Entregas programadas/)
  assert.match(agenda, /Confirmados/)
  assert.match(agenda, /Em andamento/)
  assert.match(agenda, /Prontos/)
})

test('order navigation preserves the selected agenda date', () => {
  assert.match(agenda, /agenda_date=\$\{selectedDate\}/)
  assert.match(factory, /searchParams\.get\('date'\)/)
  assert.match(factory, /initialDate=\{agendaDate\}/)
  assert.match(orders, /searchParams\.get\('agenda_date'\)/)
  assert.match(orders, /params\.set\('date', selectedDate\)/)
  assert.match(orders, /productionPath\(order, agendaDate\)/)
})

test('production agenda advances orders with protected operator feedback', () => {
  assert.ok(agenda.includes('apiFetch<Order>(`/api/orders/${order.id}`'))
  assert.match(agenda, /method: 'PATCH'/)
  assert.match(agenda, /status: nextStatus/)
  assert.match(agenda, /disabled=\{updatingId !== null\}/)
  assert.match(agenda, /Atualizando\.\.\./)
  assert.match(agenda, /role="alert"/)
  assert.match(agenda, /aria-live="polite"/)
})

test('selected agenda date is synchronized with the browser address', () => {
  assert.match(agenda, /onDateChange\?\.\(value\)/)
  assert.match(factory, /nextParams\.set\('date', date\)/)
  assert.match(factory, /nextParams\.delete\('order_id'\)/)
  assert.match(factory, /setSearchParams\(nextParams, \{ replace: true \}\)/)
  assert.match(factory, /onDateChange=\{changeAgendaDate\}/)
})
