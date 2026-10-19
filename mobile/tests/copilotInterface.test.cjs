const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) =>
  fs.readFileSync(path.join(root, relative), 'utf8')

const data = read('src/features/copilot/copilotData.ts')
const types = read('src/features/copilot/copilotTypes.ts')
const service = read(
  'src/features/copilot/services/copilotService.ts'
)
const hook = read('src/features/copilot/useCopilot.ts')
const screen = read(
  'src/features/copilot/screens/CopilotScreen.tsx'
)
const route = read('src/app/(app)/copilot.tsx')
const layout = read('src/app/(app)/_layout.tsx')

test('mobile copilot exposes the ten mapped questions', () => {
  const prompts = [
    'O que precisa da minha atenção hoje?',
    'Quais pedidos estão em produção?',
    'Quais produtos estão com estoque crítico?',
    'Quais orçamentos precisam de acompanhamento?',
    'Quais notas fiscais exigem atenção?',
    'O que posso produzir com o estoque atual?',
    'Quanto vendemos hoje?',
    'Quais são os nossos principais clientes?',
    'Quantos funcionários ativos temos?',
    'Como estão distribuídos os centros de custo?',
  ]

  for (const prompt of prompts) {
    assert.ok(data.includes(prompt), `missing prompt: ${prompt}`)
  }
})

test('mobile types match every backend copilot intent', () => {
  const intents = [
    'daily_priorities',
    'orders_in_preparation',
    'critical_stock',
    'quotes_follow_up',
    'fiscal_attention',
    'production_availability',
    'sales_today',
    'top_customers',
    'active_employees',
    'cost_centers_summary',
    'unknown',
  ]

  for (const intent of intents) {
    assert.ok(types.includes(`'${intent}'`))
  }
})

test('mobile copilot uses the authenticated API contract', () => {
  assert.match(service, /apiFetch<CopilotChatResponse>/)
  assert.match(service, /'\/api\/copilot\/chat'/)
  assert.match(service, /method: 'POST'/)
  assert.match(service, /JSON\.stringify\(\{ message \}\)/)
})

test('mobile hook maps structured responses', () => {
  for (const field of [
    'status',
    'tool',
    'items',
    'actions',
    'confirmation',
  ]) {
    assert.ok(hook.includes(`${field}: response.${field}`))
  }
})

test('mobile hook preserves a failed prompt for retry', () => {
  assert.match(hook, /retryPrompt: text/)
  assert.match(hook, /appendUserMessage: false/)
  assert.match(hook, /removeErrorMessageId: messageId/)
  assert.match(hook, /requestInFlight/)
})

test('mobile conversation exposes loading and input protections', () => {
  assert.match(screen, /Consultando\.\.\./)
  assert.match(screen, /maxLength=\{500\}/)
  assert.match(screen, /editable=\{!sending\}/)
  assert.match(screen, /sending \|\| !input\.trim\(\)/)
  assert.match(screen, /Tentar novamente/)
})

test('mobile copilot displays real and guided response states', () => {
  assert.match(screen, /Consulta real/)
  assert.match(screen, /Orientação controlada/)
  assert.match(screen, /Confirmação necessária/)
  assert.match(screen, /Contexto protegido/)
})

test('mobile copilot route and tab are registered', () => {
  assert.match(route, /CopilotScreen as default/)
  assert.match(layout, /name="copilot"/)
  assert.match(layout, /title: 'Copiloto'/)
})

test('orders action opens the available mobile module', () => {
  assert.match(screen, /'\/pedidos': '\/orders'/)
  assert.match(screen, /Abrir no aplicativo/)
  assert.match(screen, /disponível no web/)
})