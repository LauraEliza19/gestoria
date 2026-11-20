// Correções do fluxo de venda encontradas na simulação de cliente:
// venda sob encomenda, data de entrega na conversão, contas a receber,
// CPF/CNPJ, datas locais, quantidades, NCM, erros em português e Visão geral.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

function load(relative) {
  const source = read(relative)
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: relative,
  })
  const compiled = new Module(relative, module)
  compiled.filename = path.join(root, relative)
  compiled.paths = module.paths
  compiled._compile(outputText, compiled.filename)
  return compiled.exports
}

const formatting = load('src/utils/formatting.ts')
const documents = load('src/utils/documents.ts')
const validation = load('src/utils/validationMessages.ts')

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

test('quantidades aparecem sem zeros inúteis, no padrão brasileiro', () => {
  assert.equal(formatting.formatQuantity('3.000'), '3')
  assert.equal(formatting.formatQuantity('1.500'), '1,5')
  assert.equal(formatting.formatQuantity('0.250'), '0,25')
  assert.equal(formatting.formatQuantity(12), '12')
})

test('a data padrão usa o dia local, mesmo depois das 21h', () => {
  // 22h40 do dia 18 em Brasília já é dia 19 em UTC.
  const lateEvening = new Date(2026, 10, 18, 22, 40)
  assert.equal(formatting.localDateInputValue(lateEvening), '2026-11-18')
  assert.equal(formatting.localDateAfterDays(7, lateEvening), '2026-11-25')
  assert.equal(formatting.defaultDeliveryInputValue(lateEvening), '2026-11-19T12:00')
})

test('telefone, CEP e número do pedido ficam legíveis', () => {
  assert.equal(formatting.formatPhone('3537142200'), '(35) 3714-2200')
  assert.equal(formatting.formatPhone('35999998888'), '(35) 99999-8888')
  assert.equal(formatting.formatPhone('123'), '123')
  assert.equal(formatting.maskPhoneInput('35999998888'), '(35) 99999-8888')
  assert.equal(formatting.maskPhoneInput('353714'), '(35) 3714')
  assert.equal(formatting.maskPostalCode('37701000'), '37701-000')
  assert.equal(formatting.orderLabel({ id: '5abcd9db-1111', code: 'PED-000003' }), 'PED-000003')
  assert.equal(formatting.orderLabel({ id: '5abcd9db-1111', code: null }), '#5ABCD9DB')
})

test('o rendimento da receita não repete nem erra o plural', () => {
  assert.equal(formatting.formatYield('1.000', 'unidades'), '1 unidade')
  assert.equal(formatting.formatYield('12.000', 'unidades'), '12 unidades')
  assert.equal(formatting.formatYield('2.000', 'unidade'), '2 unidades')
  assert.equal(formatting.formatYield('1.500', 'kg'), '1,5 kg')
})

// ---------------------------------------------------------------------------
// CPF/CNPJ
// ---------------------------------------------------------------------------

test('CPF e CNPJ são conferidos pelos dígitos verificadores', () => {
  assert.equal(documents.isValidCpf('123.456.789-09'), true)
  assert.equal(documents.isValidCpf('12345678901'), false)
  assert.equal(documents.isValidCpf('111.111.111-11'), false)
  assert.equal(documents.isValidCnpj('11.222.333/0001-81'), true)
  assert.equal(documents.isValidCnpj('12.345.678/0001-95'), true)
  // Os dois documentos aceitos na simulação, que deveriam ter sido barrados.
  assert.equal(documents.isValidCnpj('12.345.678/0001-00'), false)
  assert.equal(documents.isValidCnpj('11.111.111/1111-11'), false)
})

test('as mensagens de CPF/CNPJ dizem o que corrigir', () => {
  assert.equal(documents.taxDocumentError(''), '')
  assert.equal(documents.taxDocumentError('123.456.789-09', 'individual'), '')
  assert.match(documents.taxDocumentError('11.111.111/1111-11'), /CNPJ inválido/)
  assert.match(documents.taxDocumentError('1234'), /CPF tem 11 e o CNPJ tem 14/)
  assert.match(documents.taxDocumentError('11.222.333/0001-81', 'individual'), /pessoa jurídica/)
  assert.match(documents.taxDocumentError('123.456.789-09', 'company'), /pessoa física/)
})

test('a máscara de documento acompanha a digitação', () => {
  assert.equal(documents.maskTaxDocument('12345678909'), '123.456.789-09')
  assert.equal(documents.maskTaxDocument('1234567'), '123.456.7')
  assert.equal(documents.maskTaxDocument('11222333000181'), '11.222.333/0001-81')
  assert.equal(documents.BRAZILIAN_STATES.length, 27)
  assert.ok(documents.BRAZILIAN_STATES.includes('MG'))
})

// ---------------------------------------------------------------------------
// Erros do servidor em português
// ---------------------------------------------------------------------------

test('erros de validação do servidor viram português com o nome do campo', () => {
  const tooLong = {
    type: 'string_too_long',
    loc: ['body', 'state'],
    msg: 'String should have at most 2 characters',
    ctx: { max_length: 2 },
  }
  assert.equal(validation.validationMessage([tooLong]), 'Estado (UF): use no máximo 2 caracteres.')
  assert.equal(
    validation.translateValidationIssue({
      type: 'value_error',
      loc: ['body', 'document'],
      msg: 'Value error, CNPJ inválido. Confira os números digitados.',
    }),
    'CNPJ inválido. Confira os números digitados.',
  )
  assert.equal(
    validation.translateValidationIssue({
      type: 'value_error',
      loc: ['body', 'email'],
      msg: 'value is not a valid email address: An email address must have an @-sign.',
    }),
    'E-mail: endereço inválido.',
  )
  assert.equal(
    validation.translateValidationIssue({
      type: 'missing',
      loc: ['body', 'name'],
      msg: 'Field required',
    }),
    'Nome é obrigatório.',
  )
  assert.equal(validation.validationMessage('texto'), undefined)
})

test('a camada de API usa a tradução nos erros 422', () => {
  const api = read('src/services/api.ts')
  assert.match(api, /validationMessage\(body\.detail\)/)
})

// ---------------------------------------------------------------------------
// Telas
// ---------------------------------------------------------------------------

test('produto pode ser vendido sob encomenda e o NCM aceita pontos', () => {
  const form = read('src/pages/Products/ProductFormPage.tsx')
  assert.match(form, /made_to_order: false/)
  assert.match(form, /Vendido sob encomenda/)
  assert.match(form, /<option value="confeitaria">Confeitaria<\/option>/)
  assert.match(form, /<option value="l">Litro<\/option>/)
  // O limite de 8 no campo cortava "1905.90.90" antes de tirar os pontos.
  assert.doesNotMatch(form, /maxLength=\{8\}/)
  assert.doesNotMatch(form, /maxLength=\{7\}/)
  assert.match(form, /decimal\(form\.min_stock_quantity\) \?\? 5/)
  // Ao editar, o estoque aparece como "2" e o preço como "85,00", não "2.000" e "85.00".
  assert.match(form, /return \[key, toInputValue\(formKey, value\)\]/)
  assert.match(form, /number\.toFixed\(2\)\.replace\('\.', ','\)/)
  assert.match(form, /value\.replace\(\/\\\.\/g, ''\)\.replace\(',', '\.'\)/)
})

test('o pedido mostra sob encomenda, busca produto e formata quantidades', () => {
  const form = read('src/pages/Orders/OrderFormPage.tsx')
  assert.match(form, /'sob encomenda'/)
  assert.match(form, /aria-label="Buscar produto na lista"/)
  assert.match(form, /formatQuantity\(item\.quantity\)/)
  assert.match(form, /A conta a receber já está no Financeiro/)

  const list = read('src/pages/Orders/OrdersPage.tsx')
  assert.match(list, /<p className="eyebrow">Comercial<\/p>/)
  assert.match(list, /orderLabel\(order\)/)
  assert.match(list, /formatQuantity\(item\.quantity\)/)
  assert.match(list, /parcelas ainda não recebidas são canceladas/)
})

test('converter orçamento pede entrega e mostra o erro dentro do formulário', () => {
  const quotes = read('src/pages/Quotes/QuotesPage.tsx')
  assert.match(quotes, /onClick=\{\(\) => startConversion\(quote\)\}/)
  assert.match(quotes, /type="datetime-local"/)
  assert.match(quotes, /promised_at: promisedAt\.toISOString\(\)/)
  assert.match(quotes, /role="dialog"/)
  assert.match(quotes, /\{conversionError\}/)
  assert.match(quotes, /aria-label=\{`Situação do orçamento de \$\{quote\.customer_name\}`\}/)
  assert.match(quotes, /localDateAfterDays\(7\)/)
  assert.doesNotMatch(quotes, /toISOString\(\)\.slice\(0, 10\)/)
})

test('lançamentos usam a data local e o atalho de categoria volta ao lançamento', () => {
  const entry = read('src/pages/Finance/FinanceEntryFormPage.tsx')
  assert.match(entry, /useState\(\(\) => localDateInputValue\(\)\)/)
  assert.doesNotMatch(entry, /toISOString\(\)\.slice\(0, 10\)/)

  const category = read('src/pages/Finance/FinanceCategoryFormPage.tsx')
  assert.match(category, /lancamento: '\/financeiro\/lancamentos\/novo'/)
  assert.match(category, /navigate\(returnPath, \{ replace: true \}\)/)

  const fiscal = read('src/pages/Fiscal/fiscalUtils.ts')
  assert.match(fiscal, /issue_date: localToday\(\)/)
})

test('contas a receber de pedidos levam ao pedido de origem', () => {
  assert.match(read('src/pages/Finance/FinanceAccountsPage.tsx'), /entry\.order_id &&/)
  assert.match(read('src/pages/Finance/FinancePage.tsx'), /entry\.order_id &&/)
  assert.match(read('src/services/finance.service.ts'), /order_id\?: string \| null/)
})

test('Clientes e Empresa conferem CPF/CNPJ e usam lista de UF', () => {
  for (const file of [
    'src/pages/Customers/CustomerFormPage.tsx',
    'src/pages/Company/CompanyPage.tsx',
  ]) {
    const source = read(file)
    assert.match(source, /taxDocumentError\(/, file)
    assert.match(source, /maskTaxDocument/, file)
    assert.match(source, /BRAZILIAN_STATES\.map/, file)
    assert.match(source, /if \(documentProblem\) \{/, file)
  }
  assert.match(read('src/pages/Customers/CustomersPage.tsx'), /formatPhone\(customer\.phone\)/)
})

test('a Visão geral mostra notas pendentes, saldo e primeiros passos', () => {
  const dashboard = read('src/pages/Dashboard/DashboardPage.tsx')
  assert.match(dashboard, /apiFetch<DashboardOverview>\('\/api\/dashboard\/overview'\)/)
  assert.match(dashboard, /label: 'Notas fiscais pendentes'/)
  assert.match(dashboard, /can\('finance:read'\)/)
  assert.match(dashboard, /label="Saldo realizado"/)
  assert.match(dashboard, /Primeiros passos/)
  assert.match(dashboard, /product\.made_to_order \|\| product\.is_active === false/)
  assert.match(dashboard, /Nenhum cliente cadastrado ainda\./)
})

test('acabamentos: Enter envia no Copiloto e a receita não nasce preenchida', () => {
  const copilot = read('src/pages/Copilot/CopilotConversation.tsx')
  assert.match(copilot, /event\.key === 'Enter' && !event\.shiftKey/)
  assert.match(copilot, /requestSubmit\(\)/)

  const recipe = read('src/pages/FactoryMode/ProductionForms.tsx')
  assert.match(recipe, /useState\(recipe\?\.yield_unit \?\? ''\)/)
  assert.match(recipe, /list="recipe-yield-units"/)

  const preview = read('src/pages/Fiscal/FiscalDocumentForm.tsx')
  assert.match(preview, /<FiscalItems items=\{previewItems\} \/>/)
})
