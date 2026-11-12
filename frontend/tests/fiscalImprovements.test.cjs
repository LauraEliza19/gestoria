// Testes das melhorias do Módulo Fiscal.
// Compila os arquivos .ts/.tsx do módulo com o TypeScript do projeto e renderiza os
// componentes com um mini-runtime React (sem DOM), para validar comportamento e marcação.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const fiscalDir = 'pages/Fiscal'
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

// ---------------------------------------------------------------------------
// Mini-runtime React: monta a árvore de elementos executando os componentes.
// ---------------------------------------------------------------------------
const Fragment = Symbol('Fragment')
const effects = []

const reactStub = {
  Fragment,
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: (effect) => effects.push(effect),
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  useRef: (initial) => ({ current: initial }),
  useContext: () => ({}),
  createContext: () => ({}),
}
const jsx = (type, props, key) => ({ type, props: props || {}, key })
const jsxRuntimeStub = { jsx, jsxs: jsx, Fragment }
const routerStub = {
  Link: ({ children, to, ...rest }) => jsx('a', { href: to, ...rest, children }),
  useSearchParams: () => [new URLSearchParams(), () => {}],
}
const lucideStub = new Proxy(
  {},
  {
    get: (_target, name) => {
      if (name === '__esModule') return false
      const Icon = (props) => jsx('svg', { ...props, 'data-icon': String(name) })
      Icon.displayName = String(name)
      return Icon
    },
  },
)
const stubs = {
  react: reactStub,
  'react/jsx-runtime': jsxRuntimeStub,
  'react-router-dom': routerStub,
  'lucide-react': lucideStub,
  'react-dom': { createPortal: (node) => node },
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gestoria-fiscal-'))
for (const directory of [fiscalDir, 'components/forms']) {
  const sourceDir = path.join(root, 'src', directory)
  const targetDir = path.join(outDir, directory)
  fs.mkdirSync(targetDir, { recursive: true })
  for (const file of fs.readdirSync(sourceDir)) {
    if (!/\.tsx?$/.test(file)) continue
    const source = fs.readFileSync(path.join(sourceDir, file), 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: file,
    })
    fs.writeFileSync(path.join(targetDir, file.replace(/\.tsx?$/, '.js')), outputText)
  }
}

const originalLoad = Module._load
Module._load = function load(request, parent, isMain) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request]
  if (request.startsWith('../../') && !request.startsWith('../../components/forms/')) return {}
  return originalLoad.call(this, request, parent, isMain)
}
const load = (name) => require(path.join(outDir, fiscalDir, `${name}.js`))

function render(node) {
  if (node === null || node === undefined || node === false || node === true) return []
  if (Array.isArray(node)) return node.flatMap(render)
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (typeof node.type === 'function') return render(node.type(node.props))
  if (node.type === Fragment) return render(node.props.children)
  return [{ type: node.type, props: node.props, children: render(node.props.children) }]
}
const mount = (Component, props) => render(jsx(Component, props))
function findAll(nodes, predicate, found = []) {
  for (const node of nodes) {
    if (typeof node === 'string') continue
    if (predicate(node)) found.push(node)
    findAll(node.children, predicate, found)
  }
  return found
}
const textOf = (nodes) =>
  nodes.map((node) => (typeof node === 'string' ? node : textOf(node.children))).join('')
const byType = (nodes, type) => findAll(nodes, (node) => node.type === type)
const buttonByText = (nodes, label) =>
  byType(nodes, 'button').find((button) => textOf(button.children).includes(label))
const fakeEvent = () => {
  const event = { prevented: false, preventDefault: () => (event.prevented = true) }
  return event
}

const utils = load('fiscalUtils')

// ---------------------------------------------------------------------------
// Dados de exemplo
// ---------------------------------------------------------------------------
const baseDocument = (overrides = {}) => ({
  id: 'doc-1',
  document_type: 'saida',
  number: '123',
  series: '1',
  model: '55',
  participant_name: 'Cliente Teste',
  participant_document: '11144477735',
  issue_date: '2026-10-30',
  cfop: '5102',
  operation_nature: 'Venda de mercadoria',
  value: '150.00',
  status: 'Autorizada',
  order_id: 'order-1',
  supplier_id: null,
  created_by_id: '9f8e7d6c-0000-4000-8000-000000000001',
  created_by_name: 'Lucas Teste',
  created_by_email: 'lucas@gestoria.dev',
  created_at: '2026-10-30T12:00:00Z',
  updated_at: '2026-10-30T12:00:00Z',
  authorized_at: '2026-10-30T12:05:00Z',
  cancelled_at: null,
  authorization_protocol: '135240000000001',
  cancellation_protocol: null,
  cancellation_reason: null,
  access_key: '1'.repeat(44),
  is_legacy: false,
  snapshot_source: 'order',
  reconciled_at: null,
  stock_received_at: null,
  items: [
    {
      id: 'item-1',
      product_id: 'p1',
      product_name: 'Café',
      quantity: '2.5',
      unit_price: '10.00',
      unit_of_measure: 'unit',
      total: '25.00',
    },
  ],
  allowed_statuses: ['Cancelada'],
  events: [
    {
      id: 'ev-1',
      action: 'created',
      actor_id: '9f8e7d6c-0000-4000-8000-000000000001',
      actor_name: 'Lucas Teste',
      actor_email: 'lucas@gestoria.dev',
      created_at: '2026-10-30T12:00:00Z',
      detail: {},
    },
  ],
  ...overrides,
})

const emptyForm = () => ({
  document_type: 'saida',
  order_id: '',
  supplier_id: '',
  number: '',
  series: '1',
  model: '55',
  issue_date: '2026-11-01',
  cfop: '',
  operation_nature: '',
  access_key: '',
})
const validForm = (overrides = {}) => ({
  ...emptyForm(),
  order_id: 'o1',
  number: '10',
  ...overrides,
})
const emptyEvent = (overrides = {}) => ({
  status: '',
  occurred_at: '',
  protocol: '',
  reason: '',
  ...overrides,
})

// ===========================================================================
// 1. Validação de CPF
// ===========================================================================
test('CPF válido sem máscara é aceito', () => assert.equal(utils.isValidCpf('11144477735'), true))
test('CPF válido com máscara é aceito', () =>
  assert.equal(utils.isValidCpf('111.444.777-35'), true))
test('CPF com dígito verificador errado é rejeitado', () =>
  assert.equal(utils.isValidCpf('11144477736'), false))
test('CPF com todos os dígitos iguais é rejeitado', () =>
  assert.equal(utils.isValidCpf('11111111111'), false))
test('CPF com 10 dígitos é rejeitado', () => assert.equal(utils.isValidCpf('1114447773'), false))
test('CPF com 12 dígitos é rejeitado', () => assert.equal(utils.isValidCpf('111444777351'), false))
test('CPF vazio ou nulo é rejeitado', () => {
  assert.equal(utils.isValidCpf(''), false)
  assert.equal(utils.isValidCpf(null), false)
})
test('segundo CPF válido conhecido é aceito', () =>
  assert.equal(utils.isValidCpf('52998224725'), true))

// ===========================================================================
// 2. Validação de CNPJ
// ===========================================================================
test('CNPJ válido sem máscara é aceito', () =>
  assert.equal(utils.isValidCnpj('11222333000181'), true))
test('CNPJ válido com máscara é aceito', () =>
  assert.equal(utils.isValidCnpj('11.222.333/0001-81'), true))
test('CNPJ com dígito verificador errado é rejeitado', () =>
  assert.equal(utils.isValidCnpj('11222333000182'), false))
test('CNPJ com todos os dígitos iguais é rejeitado', () =>
  assert.equal(utils.isValidCnpj('00000000000000'), false))
test('CNPJ com 13 dígitos é rejeitado', () =>
  assert.equal(utils.isValidCnpj('1122233300018'), false))
test('CNPJ com 15 dígitos é rejeitado', () =>
  assert.equal(utils.isValidCnpj('112223330001810'), false))
test('segundo CNPJ válido conhecido é aceito', () =>
  assert.equal(utils.isValidCnpj('45723174000110'), true))
test('CNPJ nulo é rejeitado', () => assert.equal(utils.isValidCnpj(undefined), false))

// ===========================================================================
// 3. Mensagens de erro de CPF/CNPJ (quantidade de dígitos)
// ===========================================================================
test('documento vazio pede CPF ou CNPJ', () =>
  assert.equal(utils.taxIdError(''), 'Informe o CPF ou CNPJ.'))
test('10 dígitos informa quantidade inválida', () =>
  assert.match(utils.taxIdError('1234567890'), /Quantidade de dígitos inválida \(10\)/))
test('12 dígitos informa quantidade inválida', () =>
  assert.match(utils.taxIdError('123456789012'), /\(12\)/))
test('13 dígitos informa quantidade inválida', () =>
  assert.match(utils.taxIdError('1234567890123'), /\(13\)/))
test('mensagem explica que CPF tem 11 e CNPJ 14 dígitos', () =>
  assert.match(utils.taxIdError('123'), /CPF tem 11 dígitos e CNPJ tem 14/))
test('CPF com verificador errado tem mensagem específica', () =>
  assert.match(utils.taxIdError('11144477700'), /CPF inválido/))
test('CNPJ com verificador errado tem mensagem específica', () =>
  assert.match(utils.taxIdError('11222333000100'), /CNPJ inválido/))
test('documentos válidos não geram erro', () => {
  assert.equal(utils.taxIdError('111.444.777-35'), '')
  assert.equal(utils.taxIdError('11.222.333/0001-81'), '')
  assert.equal(utils.isValidTaxId('11222333000181'), true)
})

// ===========================================================================
// 4. Formatação: CPF/CNPJ, CEP e telefone
// ===========================================================================
test('máscara progressiva de CPF durante digitação', () => {
  assert.equal(utils.maskTaxIdInput('111'), '111')
  assert.equal(utils.maskTaxIdInput('1114'), '111.4')
  assert.equal(utils.maskTaxIdInput('1114447'), '111.444.7')
  assert.equal(utils.maskTaxIdInput('11144477735'), '111.444.777-35')
})
test('máscara muda para CNPJ acima de 11 dígitos', () =>
  assert.equal(utils.maskTaxIdInput('11222333000181'), '11.222.333/0001-81'))
test('máscara ignora letras e limita a 14 dígitos', () =>
  assert.equal(utils.maskTaxIdInput('11a222b333000181999'), '11.222.333/0001-81'))
test('formatTaxId formata CPF e CNPJ completos', () => {
  assert.equal(utils.formatTaxId('11144477735'), '111.444.777-35')
  assert.equal(utils.formatTaxId('11222333000181'), '11.222.333/0001-81')
  assert.equal(utils.formatTaxId(null), 'Não informado')
})
test('CEP é formatado como 00000-000', () => {
  assert.equal(utils.formatCep('37701000'), '37701-000')
  assert.equal(utils.formatCep('37701-000'), '37701-000')
})
test('CEP incompleto é mantido como informado', () => assert.equal(utils.formatCep('377'), '377'))
test('CEP vazio retorna texto vazio', () => assert.equal(utils.formatCep(null), ''))
test('celular com DDD é formatado', () =>
  assert.equal(utils.formatPhone('35999998888'), '(35) 99999-8888'))
test('telefone fixo com DDD é formatado', () =>
  assert.equal(utils.formatPhone('3537221234'), '(35) 3722-1234'))
test('telefone com +55 remove o código do país', () =>
  assert.equal(utils.formatPhone('+55 35 99999-8888'), '(35) 99999-8888'))
test('telefone sem DDD é formatado', () => {
  assert.equal(utils.formatPhone('999998888'), '99999-8888')
  assert.equal(utils.formatPhone('37221234'), '3722-1234')
})
test('telefone desconhecido é mantido', () => assert.equal(utils.formatPhone('123'), '123'))

// ===========================================================================
// 5. Padronização de unidades (un, kg, g, l)
// ===========================================================================
for (const [input, expected] of [
  ['unit', 'un'],
  ['UN', 'un'],
  ['Unidade', 'un'],
  ['und', 'un'],
  ['KG', 'kg'],
  ['quilograma', 'kg'],
  ['G', 'g'],
  ['gramas', 'g'],
  ['L', 'l'],
  ['litros', 'l'],
  ['lt', 'l'],
]) {
  test(`unidade "${input}" vira "${expected}"`, () =>
    assert.equal(utils.formatUnit(input), expected))
}
test('unidade vazia assume "un"', () => {
  assert.equal(utils.formatUnit(''), 'un')
  assert.equal(utils.formatUnit(null), 'un')
})
test('lista oficial de unidades é un, kg, g e l', () =>
  assert.deepEqual([...utils.FISCAL_UNITS], ['un', 'kg', 'g', 'l']))

// ===========================================================================
// 6. Chave de acesso e CFOP
// ===========================================================================
test('chave de acesso vazia é opcional', () => assert.equal(utils.accessKeyError(''), ''))
test('chave com 44 dígitos é válida', () => assert.equal(utils.accessKeyError('1'.repeat(44)), ''))
test('chave com 43 dígitos é rejeitada', () =>
  assert.match(utils.accessKeyError('1'.repeat(43)), /44 dígitos \(informados: 43\)/))
test('chave com letras é rejeitada', () =>
  assert.match(utils.accessKeyError('A'.repeat(44)), /somente números/))
test('CFOP vazio é opcional', () => assert.equal(utils.cfopError(''), ''))
test('CFOP 5102 e 5.102 são válidos', () => {
  assert.equal(utils.cfopError('5102'), '')
  assert.equal(utils.cfopError('5.102'), '')
})
test('CFOP iniciando com 8 ou 0 é rejeitado', () => {
  assert.match(utils.cfopError('8102'), /CFOP deve ter 4 dígitos/)
  assert.match(utils.cfopError('0102'), /CFOP/)
})
test('CFOP com 3 dígitos é rejeitado', () => assert.notEqual(utils.cfopError('510'), ''))
test('há exemplos de CFOP e natureza da operação', () => {
  assert.ok(utils.CFOP_EXAMPLES.some((example) => example.code === '5102'))
  assert.ok(utils.OPERATION_NATURE_EXAMPLES.includes('Venda de mercadoria'))
})

// ===========================================================================
// 7. Validação do formulário de nova nota
// ===========================================================================
test('saída sem pedido vinculado gera erro', () =>
  assert.equal(
    utils.fiscalDocumentFormErrors(emptyForm()).order_id,
    'Selecione o pedido vinculado.',
  ))
test('formulário de saída completo não tem erros', () =>
  assert.deepEqual(utils.fiscalDocumentFormErrors(validForm()), {}))
test('número, série e data são obrigatórios', () => {
  const errors = utils.fiscalDocumentFormErrors(
    validForm({ number: ' ', series: '', issue_date: '' }),
  )
  assert.ok(errors.number && errors.series && errors.issue_date)
})
test('entrada exige fornecedor', () =>
  assert.ok(
    utils.fiscalDocumentFormErrors(validForm({ document_type: 'entrada', order_id: '' }), [
      { product_id: 'p', quantity: '1', unit_price: '1' },
    ]).supplier_id,
  ))
test('entrada exige itens válidos', () => {
  const form = validForm({ document_type: 'entrada', order_id: '', supplier_id: 's' })
  assert.ok(utils.fiscalDocumentFormErrors(form, []).items)
  assert.ok(
    utils.fiscalDocumentFormErrors(form, [{ product_id: '', quantity: '1', unit_price: '1' }])
      .items,
  )
  assert.ok(
    utils.fiscalDocumentFormErrors(form, [{ product_id: 'p', quantity: '0', unit_price: '1' }])
      .items,
  )
})
test('entrada completa não tem erros', () =>
  assert.deepEqual(
    utils.fiscalDocumentFormErrors(
      validForm({ document_type: 'entrada', order_id: '', supplier_id: 's' }),
      [{ product_id: 'p', quantity: '2', unit_price: '3.50' }],
    ),
    {},
  ))
test('chave e CFOP inválidos aparecem nos erros do formulário', () => {
  const errors = utils.fiscalDocumentFormErrors(validForm({ access_key: '123', cfop: '99' }))
  assert.ok(errors.access_key && errors.cfop)
})

// ===========================================================================
// 8. Dados não salvos
// ===========================================================================
const dirty = (form, items = [], baseItems = [], supplier) =>
  utils.isFiscalFormDirty(form, emptyForm(), items, baseItems, supplier)
test('formulário recém-aberto não está sujo', () => assert.equal(dirty(emptyForm()), false))
test('alterar o número marca dados não salvos', () =>
  assert.equal(dirty({ ...emptyForm(), number: '1' }), true))
test('alterar o pedido marca dados não salvos', () =>
  assert.equal(dirty({ ...emptyForm(), order_id: 'x' }), true))
test('alterar itens de entrada marca dados não salvos', () =>
  assert.equal(
    dirty(
      emptyForm(),
      [{ product_id: 'p', quantity: '1', unit_price: '0.00' }],
      [{ product_id: '', quantity: '1', unit_price: '0.00' }],
    ),
    true,
  ))
test('rascunho de fornecedor conta como dado não salvo', () =>
  assert.equal(dirty(emptyForm(), [], [], { name: 'ACME', document: '' }), true))
test('mensagem de confirmação de fechamento menciona dados não salvos', () =>
  assert.match(utils.UNSAVED_FORM_MESSAGE, /dados não salvos/))

// ===========================================================================
// 9. Evento fiscal: campos obrigatórios e confirmação
// ===========================================================================
test('evento sem situação é inválido', () =>
  assert.equal(utils.isFiscalEventFormValid(emptyEvent(), 'Em processamento'), false))
test('autorização exige data e protocolo', () => {
  assert.equal(
    utils.isFiscalEventFormValid(emptyEvent({ status: 'Autorizada' }), 'Em processamento'),
    false,
  )
  assert.equal(
    utils.isFiscalEventFormValid(
      emptyEvent({ status: 'Autorizada', occurred_at: '2026-11-01T10:00' }),
      'Em processamento',
    ),
    false,
  )
})
test('autorização completa é válida', () =>
  assert.equal(
    utils.isFiscalEventFormValid(
      emptyEvent({ status: 'Autorizada', occurred_at: '2026-11-01T10:00', protocol: '123' }),
      'Em processamento',
    ),
    true,
  ))
test('cancelamento exige motivo com 3+ caracteres', () => {
  const base = { status: 'Cancelada', occurred_at: '2026-11-01T10:00', protocol: 'p' }
  assert.equal(
    utils.isFiscalEventFormValid(emptyEvent({ ...base, reason: 'ab' }), 'Autorizada'),
    false,
  )
  assert.equal(
    utils.isFiscalEventFormValid(emptyEvent({ ...base, reason: 'erro' }), 'Autorizada'),
    true,
  )
})
test('cancelamento de nota autorizada exige protocolo', () =>
  assert.equal(
    utils.isFiscalEventFormValid(
      emptyEvent({ status: 'Cancelada', occurred_at: '2026-11-01T10:00', reason: 'erro' }),
      'Autorizada',
    ),
    false,
  ))
test('cancelamento de nota não autorizada dispensa protocolo', () =>
  assert.equal(
    utils.isFiscalEventFormValid(
      emptyEvent({ status: 'Cancelada', occurred_at: '2026-11-01T10:00', reason: 'erro' }),
      'Rejeitada',
    ),
    true,
  ))
test('rejeição, denegação e inutilização só exigem a situação', () => {
  for (const status of ['Rejeitada', 'Denegada', 'Inutilizada']) {
    assert.equal(utils.isFiscalEventFormValid(emptyEvent({ status }), 'Em processamento'), true)
  }
})
test('situação fora das permitidas é inválida', () =>
  assert.equal(
    utils.isFiscalEventFormValid(emptyEvent({ status: 'Denegada' }), 'Autorizada', ['Cancelada']),
    false,
  ))
test('as quatro situações críticas estão definidas', () =>
  assert.deepEqual(utils.CRITICAL_FISCAL_STATUSES, [
    'Cancelada',
    'Rejeitada',
    'Denegada',
    'Inutilizada',
  ]))
for (const [status, verb] of [
  ['Cancelada', /cancelar/],
  ['Rejeitada', /rejeição/],
  ['Denegada', /denegação/],
  ['Inutilizada', /inutilizar/],
]) {
  test(`confirmação para ${status} descreve a ação e é irreversível`, () => {
    const message = utils.fiscalStatusConfirmation(status, 'a NF 10')
    assert.match(message, verb)
    assert.match(message, /a NF 10/)
    assert.match(message, /não pode ser desfeita/)
  })
}
test('autorização e processamento não pedem confirmação', () => {
  assert.equal(utils.fiscalStatusConfirmation('Autorizada', 'x'), null)
  assert.equal(utils.fiscalStatusConfirmation('Em processamento', 'x'), null)
})

// ===========================================================================
// 10. Responsável: nome e e-mail
// ===========================================================================
test('responsável com nome e e-mail', () =>
  assert.deepEqual(utils.fiscalActorLabel({ name: 'Ana', email: 'ana@x.com', id: 'abc' }), {
    name: 'Ana',
    email: 'ana@x.com',
  }))
test('responsável só com e-mail usa o e-mail como nome', () =>
  assert.deepEqual(utils.fiscalActorLabel({ email: 'ana@x.com', id: 'abc' }), {
    name: 'ana@x.com',
    email: '',
  }))
test('sem nome e e-mail cai para identificador curto', () =>
  assert.equal(utils.fiscalActorLabel({ id: '12345678-aaaa' }).name, 'Usuário 12345678'))
test('sem nenhum dado informa não registrado', () =>
  assert.equal(utils.fiscalActorLabel({}).name, 'Não registrado'))

// ===========================================================================
// 11. Renderização: histórico
// ===========================================================================
const { FiscalHistory } = load('FiscalHistory')
test('histórico exibe nome e e-mail do responsável', () => {
  const text = textOf(mount(FiscalHistory, { events: baseDocument().events }))
  assert.match(text, /Lucas Teste/)
  assert.match(text, /lucas@gestoria\.dev/)
  assert.doesNotMatch(text, /usuário 9f8e7d6c/)
})
test('histórico usa coluna "Responsável"', () =>
  assert.match(textOf(mount(FiscalHistory, { events: baseDocument().events })), /Responsável/))
test('e-mail do responsável é um link mailto', () => {
  const links = byType(mount(FiscalHistory, { events: baseDocument().events }), 'a')
  assert.equal(links[0].props.href, 'mailto:lucas@gestoria.dev')
})
test('histórico antigo sem nome mostra identificador curto', () => {
  const events = [{ ...baseDocument().events[0], actor_name: null, actor_email: null }]
  assert.match(textOf(mount(FiscalHistory, { events })), /Usuário 9f8e7d6c/)
})

// ===========================================================================
// 12. Renderização: formulário de evento fiscal
// ===========================================================================
const { FiscalStatusForm } = load('FiscalStatusForm')
const statusForm = (form, extra = {}) =>
  mount(FiscalStatusForm, {
    currentStatus: 'Autorizada',
    allowedStatuses: ['Cancelada'],
    form,
    busy: false,
    saving: false,
    closeDisabled: false,
    onAttempt: () => {},
    onClose: () => {},
    documentLabel: 'a NF 123',
    onChange: () => {},
    onSubmit: () => {},
    ...extra,
  })
const submitButton = (tree) => buttonByText(tree, 'Registrar evento')
const validCancel = emptyEvent({
  status: 'Cancelada',
  occurred_at: '2026-11-01T10:00',
  protocol: '999',
  reason: 'Erro de digitação',
})

test('"Registrar evento" fica desabilitado sem situação', () =>
  assert.equal(submitButton(statusForm(emptyEvent())).props.disabled, true))
test('"Registrar evento" continua desabilitado com campos faltando', () =>
  assert.equal(
    submitButton(statusForm(emptyEvent({ status: 'Cancelada', occurred_at: '2026-11-01T10:00' })))
      .props.disabled,
    true,
  ))
test('"Registrar evento" habilita quando tudo está válido', () =>
  assert.equal(submitButton(statusForm(validCancel)).props.disabled, false))
test('aviso explica por que o botão está desabilitado', () =>
  assert.match(textOf(statusForm(emptyEvent())), /Preencha todos os campos obrigatórios/))
test('campos obrigatórios do evento têm asterisco e legenda', () => {
  const tree = statusForm(validCancel)
  assert.ok(findAll(tree, (node) => node.props.className === 'form-required-mark').length >= 4)
  assert.match(textOf(tree), /Campos marcados com \* são obrigatórios/)
})
test('cancelamento pede confirmação e envia quando confirmado', () => {
  const calls = []
  global.window = { confirm: (message) => (calls.push(message), true) }
  let submitted = false
  const tree = statusForm(validCancel, { onSubmit: () => (submitted = true) })
  const event = fakeEvent()
  byType(tree, 'form')[0].props.onSubmit(event)
  assert.equal(calls.length, 1)
  assert.match(calls[0], /cancelar a NF 123/)
  assert.equal(submitted, true)
})
test('cancelamento não é enviado quando o usuário desiste', () => {
  global.window = { confirm: () => false }
  let submitted = false
  const tree = statusForm(validCancel, { onSubmit: () => (submitted = true) })
  const event = fakeEvent()
  byType(tree, 'form')[0].props.onSubmit(event)
  assert.equal(submitted, false)
  assert.equal(event.prevented, true)
})
for (const status of ['Rejeitada', 'Denegada', 'Inutilizada']) {
  test(`${status} também pede confirmação antes do envio`, () => {
    let asked = false
    global.window = { confirm: () => ((asked = true), true) }
    const tree = statusForm(emptyEvent({ status }), {
      currentStatus: 'Em processamento',
      allowedStatuses: [status],
    })
    byType(tree, 'form')[0].props.onSubmit(fakeEvent())
    assert.equal(asked, true)
  })
}
test('autorização não pede confirmação', () => {
  let asked = false
  global.window = { confirm: () => ((asked = true), true) }
  let submitted = false
  const tree = statusForm(
    emptyEvent({ status: 'Autorizada', occurred_at: '2026-11-01T10:00', protocol: '1' }),
    {
      currentStatus: 'Em processamento',
      allowedStatuses: ['Autorizada'],
      onSubmit: () => (submitted = true),
    },
  )
  byType(tree, 'form')[0].props.onSubmit(fakeEvent())
  assert.equal(asked, false)
  assert.equal(submitted, true)
})
test('envio inválido é bloqueado mesmo se o botão for acionado', () => {
  let submitted = false
  const tree = statusForm(emptyEvent({ status: 'Cancelada' }), {
    onSubmit: () => (submitted = true),
  })
  const event = fakeEvent()
  byType(tree, 'form')[0].props.onSubmit(event)
  assert.equal(submitted, false)
  assert.equal(event.prevented, true)
})

// ===========================================================================
// 13. Renderização: formulário de nova nota
// ===========================================================================
const { FiscalDocumentForm } = load('FiscalDocumentForm')
const documentForm = (form = emptyForm(), extra = {}) =>
  mount(FiscalDocumentForm, {
    form,
    setForm: () => {},
    orders: [{ id: 'o1', customer_name: 'Cliente', status: 'open', total_amount: '10', items: [] }],
    suppliers: [{ id: 's1', name: 'Fornecedor', document: '11222333000181', is_active: true }],
    products: [{ id: 'p1', name: 'Farinha', is_active: true, unit_of_measure: 'kg' }],
    draftItems: [{ product_id: 'p1', quantity: '1', unit_price: '2' }],
    setDraftItems: () => {},
    supplierForm: { name: '', document: '' },
    setSupplierForm: () => {},
    busy: false,
    loading: false,
    saving: false,
    supplierSaving: false,
    onAttempt: () => {},
    isOccupied: () => false,
    onSubmit: () => {},
    onCreateSupplier: () => {},
    onClose: () => {},
    ...extra,
  })

test('rótulo agora é "Pedido vinculado *"', () => {
  const text = textOf(documentForm())
  assert.match(text, /Pedido vinculado \*/)
  assert.doesNotMatch(text, /Pedido obrigatório/)
})
test('formulário informa claramente que foi aberto', () => {
  const status = findAll(documentForm(), (node) => node.props.role === 'status')
  assert.match(textOf(status), /Formulário de nova nota aberto/)
})
test('formulário avisa quando há alterações não salvas', () =>
  assert.match(textOf(documentForm(emptyForm(), { dirty: true })), /Alterações não salvas/))
test('título do formulário recebe foco (tabIndex -1) e tem âncora', () => {
  const tree = documentForm()
  const heading = byType(tree, 'h2')[0]
  assert.equal(heading.props.tabIndex, -1)
  assert.equal(tree[0].props.id, 'fiscal-new-document')
})
test('campos obrigatórios da nota são marcados com asterisco', () => {
  const marks = findAll(documentForm(), (node) => node.props.className === 'form-required-mark')
  // Tipo, Pedido, Modelo, Número, Série, Data + legenda.
  assert.ok(marks.length >= 7, `encontrados ${marks.length}`)
})
test('campo da chave de acesso ocupa a linha inteira', () => {
  const wide = findAll(documentForm(), (node) => node.props.className === 'fiscal-field-wide')
  assert.equal(wide.length, 1)
  assert.match(textOf(wide), /Chave de acesso/)
})
test('chave de acesso mostra contador de dígitos', () =>
  assert.match(textOf(documentForm(validForm({ access_key: '123' }))), /3\/44 dígitos/))
test('CFOP tem placeholder e exemplos', () => {
  const tree = documentForm()
  const cfop = byType(tree, 'input').find((input) => input.props.list === 'fiscal-cfop-examples')
  assert.equal(cfop.props.placeholder, 'Ex.: 5102')
  assert.match(textOf(tree), /5102 \(venda dentro do estado\)/)
})
test('natureza da operação tem placeholder e exemplos', () => {
  const tree = documentForm()
  const nature = byType(tree, 'input').find(
    (input) => input.props.list === 'fiscal-nature-examples',
  )
  assert.equal(nature.props.placeholder, 'Ex.: Venda de mercadoria')
  assert.ok(byType(tree, 'datalist').length === 2)
})
test('"Fechar formulário" chama o fechamento com confirmação do hook', () => {
  let closed = false
  const tree = documentForm(emptyForm(), { onClose: () => (closed = true) })
  buttonByText(tree, 'Fechar formulário').props.onClick()
  assert.equal(closed, true)
})
test('envio fiscal bloqueia o submit e o retorno enquanto salva', () => {
  let attempts = 0
  const tree = documentForm(validForm(), {
    busy: true,
    saving: true,
    onSubmit: () => attempts++,
  })
  const submit = buttonByText(tree, 'Salvando...')
  assert.equal(submit.props.disabled, true)
  assert.equal(submit.props['aria-busy'], true)
  assert.equal(buttonByText(tree, 'Voltar à lista de notas fiscais').props.disabled, true)
  assert.equal(buttonByText(tree, 'Fechar formulário').props.disabled, true)
  byType(tree, 'form')[0].props.onSubmit(fakeEvent())
  assert.equal(attempts, 0)
})
test('uma consulta em andamento não bloqueia fechar o formulário fiscal', () => {
  const tree = documentForm(emptyForm(), { busy: true })
  assert.equal(buttonByText(tree, 'Registrar documento').props.disabled, true)
  assert.ok(!buttonByText(tree, 'Fechar formulário').props.disabled)
})
test('envio com campos obrigatórios vazios é bloqueado', () => {
  let submitted = false
  const tree = documentForm(emptyForm(), { onSubmit: () => (submitted = true) })
  const event = fakeEvent()
  byType(tree, 'form')[0].props.onSubmit(event)
  assert.equal(submitted, false)
  assert.equal(event.prevented, true)
})
test('envio com dados válidos é repassado', () => {
  let submitted = false
  const tree = documentForm(validForm(), { onSubmit: () => (submitted = true) })
  byType(tree, 'form')[0].props.onSubmit(fakeEvent())
  assert.equal(submitted, true)
})
test('fornecedor aparece com CNPJ formatado na entrada', () =>
  assert.match(
    textOf(documentForm(validForm({ document_type: 'entrada', order_id: '' }))),
    /11\.222\.333\/0001-81/,
  ))
test('itens de entrada mostram a unidade padronizada', () => {
  const text = textOf(documentForm(validForm({ document_type: 'entrada', order_id: '' })))
  assert.match(text, /Farinha \(kg\)/)
  assert.match(text, /Quantidade \(kg\)/)
})

// ===========================================================================
// 14. Renderização: cadastro de fornecedor
// ===========================================================================
const { FiscalSupplierForm } = load('FiscalSupplierForm')
const supplierForm = (form) =>
  mount(FiscalSupplierForm, {
    form,
    busy: false,
    saving: false,
    onAttempt: () => {},
    onChange: () => {},
    onSubmit: () => {},
  })
test('CPF/CNPJ do fornecedor aparece com máscara', () => {
  const input = byType(supplierForm({ name: 'A', document: '11222333000181' }), 'input')[1]
  assert.equal(input.props.value, '11.222.333/0001-81')
})
test('salvar fornecedor fica desabilitado com documento inválido', () =>
  assert.equal(
    buttonByText(supplierForm({ name: 'A', document: '1234567890' }), 'Salvar fornecedor').props
      .disabled,
    true,
  ))
test('salvar fornecedor habilita com CNPJ válido', () =>
  assert.equal(
    buttonByText(supplierForm({ name: 'A', document: '11222333000181' }), 'Salvar fornecedor').props
      .disabled,
    false,
  ))
test('digitação do documento guarda somente números', () => {
  let saved
  const tree = mount(FiscalSupplierForm, {
    form: { name: '', document: '' },
    busy: false,
    onChange: (value) => (saved = value),
    onSubmit: () => {},
  })
  byType(tree, 'input')[1].props.onChange({ target: { value: '11.222.333/0001-81' } })
  assert.equal(saved.document, '11222333000181')
})
test('fornecedor informa a quantidade de dígitos digitados', () =>
  assert.match(textOf(supplierForm({ name: '', document: '123' })), /3 informados/))

// ===========================================================================
// 15. Renderização: cards de resumo
// ===========================================================================
const { FiscalSummary } = load('FiscalSummary')
const summaryDocs = [
  baseDocument({ id: 'a', status: 'Autorizada' }),
  baseDocument({ id: 'b', status: 'Denegada', value: '50.00' }),
  baseDocument({ id: 'c', status: 'Inutilizada', value: '0' }),
  baseDocument({ id: 'd', status: 'Inutilizada', value: '0', document_type: 'entrada' }),
]
const summary = (extra = {}) =>
  mount(FiscalSummary, {
    documents: summaryDocs,
    type: 'saida',
    statusFilter: '',
    onSelectType: () => {},
    onSelectStatus: () => {},
    ...extra,
  })
test('resumo tem 8 cards incluindo Denegadas e Inutilizadas', () => {
  const tree = summary()
  assert.equal(byType(tree, 'article').length, 8)
  assert.match(textOf(tree), /Denegadas/)
  assert.match(textOf(tree), /Inutilizadas/)
})
test('indicador de inutilizadas conta as notas corretamente', () => {
  const card = byType(summary(), 'article').find((node) => textOf([node]).includes('Inutilizadas'))
  assert.match(textOf([card]), /Inutilizadas2/)
})
test('clicar em Denegadas filtra pela situação', () => {
  let selected
  const tree = summary({ onSelectStatus: (status) => (selected = status) })
  const button = byType(tree, 'button').find((node) => textOf([node]).includes('Denegadas'))
  button.props.onClick()
  assert.equal(selected, 'Denegada')
})
test('cards usam layout compacto e nome acessível', () => {
  const tree = summary()
  assert.match(tree[0].props.className, /fiscal-summary-compact/)
  const button = byType(tree, 'button')[0]
  assert.match(button.props['aria-label'], /Saídas: 3 notas/)
})
test('ícones dos cards são decorativos (aria-hidden)', () => {
  const icons = findAll(summary(), (node) => /fiscal-summary-icon/.test(node.props.className || ''))
  assert.ok(icons.every((icon) => icon.props['aria-hidden'] === 'true'))
})

// ===========================================================================
// 16. Renderização: ciclo de vida, itens, DANFE, lista e modal
// ===========================================================================
const { FiscalLifecycle, FISCAL_LIFECYCLE_LEGEND } = load('FiscalLifecycle')
test('ciclo de vida exibe legenda', () => {
  const text = textOf(mount(FiscalLifecycle, { document: baseDocument() }))
  assert.match(text, /Legenda/)
  assert.match(text, /Rejeitada ou denegada/)
  assert.match(text, /Numeração inutilizada/)
})
test('legenda cobre os cinco tons da linha do tempo', () =>
  assert.deepEqual(FISCAL_LIFECYCLE_LEGEND.map((item) => item.tone).sort(), [
    'danger',
    'neutral',
    'processing',
    'success',
    'warning',
  ]))
test('marcadores da linha do tempo têm nome acessível', () => {
  const dots = findAll(
    mount(FiscalLifecycle, { document: baseDocument() }),
    (node) => node.props.role === 'img',
  )
  assert.ok(dots.length > 0 && dots.every((dot) => dot.props['aria-label']))
})

const { FiscalItems } = load('FiscalItems')
test('itens da nota exibem "un" em vez de "unit"', () => {
  const text = textOf(mount(FiscalItems, { items: baseDocument().items }))
  assert.match(text, /2,5 un/)
  assert.doesNotMatch(text, /\d unit/)
})

const { FiscalDanfe } = load('FiscalDanfe')
test('DANFE formata CEP, telefone e CPF/CNPJ', () => {
  const text = textOf(
    mount(FiscalDanfe, {
      document: baseDocument(),
      organization: {
        name: 'Empresa',
        document: '11222333000181',
        postal_code: '37701000',
        phone: '35999998888',
      },
    }),
  )
  assert.match(text, /CEP 37701-000/)
  assert.match(text, /\(35\) 99999-8888/)
  assert.match(text, /111\.444\.777-35/)
})

const { FiscalDocumentList } = load('FiscalDocumentList')
test('ícones das opções da lista são decorativos e os botões têm nome', () => {
  const tree = mount(FiscalDocumentList, {
    documents: [baseDocument()],
    loading: false,
    orderFilter: '',
    type: 'saida',
    search: '',
    statusFilter: '',
    resetKey: '',
    canCreateForOrder: false,
    canEdit: true,
    busy: false,
    selectedIds: new Set(),
    onToggleSelection: () => {},
    onOpen: () => {},
    onStartOrder: () => {},
  })
  const svgs = byType(tree, 'svg')
  assert.ok(svgs.length > 0 && svgs.every((svg) => svg.props['aria-hidden'] === 'true'))
  assert.ok(
    byType(tree, 'button').every((button) => button.props['aria-label'] || textOf([button]).trim()),
  )
})

const { FiscalDocumentOverview } = load('FiscalDocumentOverview')
test('responsável original mostra nome e e-mail', () => {
  const text = textOf(mount(FiscalDocumentOverview, { document: baseDocument() }))
  assert.match(text, /Lucas Teste/)
  assert.match(text, /lucas@gestoria\.dev/)
})

// ===========================================================================
// 17. Integração no código-fonte (hook e página)
// ===========================================================================
const hook = read('src/pages/Fiscal/useFiscalDocuments.ts')
const page = read('src/pages/Fiscal/FiscalDocumentsPage.tsx')
const formSource = read('src/pages/Fiscal/FiscalDocumentForm.tsx')
const styles = read('src/styles/tailwind.css')
test('hook confirma antes de descartar dados não salvos', () => {
  assert.match(hook, /function closeForm\(\)/)
  assert.match(hook, /window\.confirm\(UNSAVED_FORM_MESSAGE\)/)
  assert.match(page, /onClose=\{\(\) => void closeForm\(\)\}/)
})
test('hook avisa o navegador ao sair com formulário preenchido', () =>
  assert.match(hook, /addEventListener\('beforeunload'/))
test('hook valida CPF/CNPJ antes de cadastrar fornecedor', () =>
  assert.match(hook, /taxIdError\(supplierForm\.document\)/))
test('formulário rola e foca automaticamente ao abrir', () => {
  assert.match(formSource, /scrollIntoView/)
  assert.match(formSource, /headingRef\.current\?\.focus/)
})
test('estilos para obrigatório, erros, resumo e legenda existem', () => {
  for (const selector of [
    '.form-required-mark',
    '.fiscal-field-error',
    '.fiscal-field-wide',
    '.fiscal-summary-compact',
    '.fiscal-lifecycle-legend',
  ]) {
    assert.ok(styles.includes(selector), `faltando ${selector}`)
  }
})

const { FiscalEmail } = load('FiscalEmail')
test('e-mail só quebra linha antes do @', () => {
  const tree = mount(FiscalEmail, { email: 'gabriel@gestoria.dev' })
  assert.equal(byType(tree, 'wbr').length, 1)
  assert.equal(textOf(tree), 'gabriel@gestoria.dev')
  assert.equal(tree[0].props.title, 'gabriel@gestoria.dev')
})
test('e-mail não é exibido em maiúsculas nem quebrado no meio', () => {
  assert.match(styles, /\.fiscal-email[^{]*\{[^}]*word-break: normal/s)
  assert.match(styles, /\.fiscal-actor-email\s*\{[^}]*normal-case/s)
  assert.doesNotMatch(styles, /\.fiscal-actor a \{[^}]*break-all/s)
})
test('campos do formulário fiscal alinham pelo topo', () =>
  assert.match(
    styles,
    /\.fiscal-form-grid > label,\s*\.fiscal-form-grid > fieldset > label\s*\{[^}]*content-start/s,
  ))

test.after(() => {
  Module._load = originalLoad
  fs.rmSync(outDir, { recursive: true, force: true })
  assert.ok(effects.length >= 0)
})
