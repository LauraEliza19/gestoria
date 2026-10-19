const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const data = read('src/pages/Copilot/copilotData.ts')
const types = read('src/pages/Copilot/copilotTypes.ts')
const hook = read('src/pages/Copilot/useCopilot.ts')
const conversation = read('src/pages/Copilot/CopilotConversation.tsx')
const page = read('src/pages/Copilot/CopilotPage.tsx')

test('copilot exposes the ten mapped business questions', () => {
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
  ]

  for (const prompt of prompts) {
    assert.ok(data.includes(`'${prompt}'`), `missing prompt: ${prompt}`)
  }

  for (const intent of intents) {
    assert.ok(types.includes(`'${intent}'`), `missing intent: ${intent}`)
  }
})

test('copilot sends messages through the controlled backend contract', () => {
  assert.match(hook, /apiFetch<CopilotChatResponse>\('\/api\/copilot\/chat'/)
  assert.match(hook, /method: 'POST'/)
  assert.match(hook, /JSON\.stringify\(\{ message: text \}\)/)
})

test('copilot maps structured backend responses to assistant messages', () => {
  for (const field of ['status', 'tool', 'items', 'actions', 'confirmation']) {
    assert.ok(hook.includes(`${field}: response.${field}`), `missing response field: ${field}`)
  }
})

test('copilot preserves the prompt and offers a safe retry after errors', () => {
  assert.match(hook, /Não foi possível consultar o Copiloto/)
  assert.match(hook, /retryPrompt: text/)
  assert.match(hook, /appendUserMessage: false/)
  assert.match(hook, /removeErrorMessageId: messageId/)
  assert.match(conversation, /Tentar novamente/)
  assert.match(conversation, /onRetry\(message\.id, message\.retryPrompt!\)/)
})

test('copilot displays structured results, actions and response status', () => {
  assert.match(conversation, /Consulta real/)
  assert.match(conversation, /Orientação controlada/)
  assert.match(conversation, /Confirmação necessária/)
  assert.match(conversation, /message\.items\.map/)
  assert.match(conversation, /regularActions\.map/)
  assert.match(conversation, /to=\{item\.path\}/)
  assert.match(conversation, /to=\{action\.path\}/)
})

test('copilot confirmation can be cancelled without applying changes', () => {
  assert.match(conversation, /aria-label="Confirmação da ação"/)
  assert.match(conversation, /message\.confirmation\.confirm_label/)
  assert.match(conversation, /message\.confirmation\.cancel_label/)
  assert.match(conversation, /Ação cancelada\. Nenhuma alteração foi realizada\./)
})

test('copilot conversation exposes accessibility and input protections', () => {
  assert.match(conversation, /role="log"/)
  assert.match(conversation, /aria-live="polite"/)
  assert.match(conversation, /aria-busy=\{sending\}/)
  assert.match(conversation, /maxLength=\{500\}/)
  assert.match(conversation, /disabled=\{sending \|\| !input\.trim\(\)\}/)
})

test('retry is connected to the conversation and not to the sidebar', () => {
  const conversationStart = page.indexOf('<CopilotConversation')
  const conversationEnd = page.indexOf('/>', conversationStart)
  const conversationBlock = page.slice(conversationStart, conversationEnd)

  const sidebarStart = page.indexOf('<CopilotSidebar')
  const sidebarEnd = page.indexOf('/>', sidebarStart)
  const sidebarBlock = page.slice(sidebarStart, sidebarEnd)

  assert.ok(conversationBlock.includes('onRetry={retryMessage}'))
  assert.equal(sidebarBlock.includes('onRetry='), false)
})
