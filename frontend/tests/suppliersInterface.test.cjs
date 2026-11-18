const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const list = read('src/pages/Suppliers/SuppliersPage.tsx')
const form = read('src/pages/Suppliers/SupplierFormPage.tsx')
const layout = read('src/layouts/DashboardLayout.tsx')
const router = read('src/app/router.tsx')
const styles = read('src/styles/tailwind.css')

test('fornecedores aparecem no menu Cadastros, junto de clientes e produtos', () => {
  const group = layout.match(/id: 'cadastros',[\s\S]*?\],\s*\},/)
  assert.ok(group, 'grupo Cadastros deveria existir')
  assert.match(group[0], /\{ to: '\/clientes', label: 'Clientes'/)
  assert.match(group[0], /\{ to: '\/produtos', label: 'Produtos'/)
  assert.match(group[0], /\{ to: '\/fornecedores', label: 'Fornecedores', icon: Truck \}/)
})

test('lista é aberta a todos, mas cadastro e edição exigem permissão', () => {
  assert.match(router, /<Route\s+path="\/fornecedores"\s+element=\{\s*<LazyRoute>/)
  for (const routePath of ['/fornecedores/novo', '/fornecedores/:supplierId/editar']) {
    const start = router.indexOf(`path="${routePath}"`)
    assert.ok(start > 0, `${routePath} deveria existir`)
    const block = router.slice(start, router.indexOf('/>\n          <Route', start))
    assert.match(block, /<PermissionGate permission="fiscal:manage">/, routePath)
  }
})

test('lista carrega todos os fornecedores e não só a primeira página', () => {
  assert.match(list, /listAllSuppliers\(\)/)
  assert.doesNotMatch(list, /apiFetchItems/)
})

test('lista busca por nome, CPF/CNPJ, telefone e e-mail e filtra por situação', () => {
  assert.match(list, /placeholder="Buscar por nome, CPF\/CNPJ, telefone ou e-mail"/)
  assert.match(list, /supplier\.name\.toLocaleLowerCase\('pt-BR'\)\.includes\(normalizedQuery\)/)
  assert.match(list, /onlyDigits\(supplier\.document\)\.includes\(queryDigits\)/)
  assert.match(list, /onlyDigits\(supplier\.phone\)\.includes\(queryDigits\)/)
  assert.match(list, /<option value="active">Somente ativos<\/option>/)
  assert.match(list, /<option value="inactive">Somente inativos<\/option>/)
})

test('lista mostra documento e telefone formatados', () => {
  assert.match(list, /formatTaxId\(supplier\.document\)/)
  assert.match(list, /formatPhone\(supplier\.phone\)/)
  assert.match(list, /supplier\.email \|\| 'Não informado'/)
})

test('ações de cadastro, edição e situação dependem de fiscal:manage', () => {
  assert.match(list, /const canManage = can\('fiscal:manage'\)/)
  assert.match(
    list,
    /\{canManage && \(\s*<Link className="primary-button gap-2" to="\/fornecedores\/novo">/,
  )
  assert.match(list, /\{canManage \? \(\s*<span className="suppliers-actions">/)
  assert.match(list, /Somente consulta/)
  assert.match(list, /to=\{`\/fornecedores\/\$\{supplier\.id\}\/editar`\}/)
})

test('fornecedor é desativado ou reativado, nunca excluído', () => {
  assert.match(list, /updateSupplier\(supplier\.id, \{\s*is_active: !supplier\.is_active,\s*\}\)/)
  assert.match(list, /'Desativar'/)
  assert.match(list, /'Reativar'/)
  assert.doesNotMatch(list, /method: 'DELETE'|Excluir/)
})

test('lista trata carregamento, erro e ausência de registros', () => {
  assert.match(list, /<LoadingState message="Carregando fornecedores\.\.\." \/>/)
  assert.match(list, /<ErrorState message=\{error\} onRetry=\{reload\} \/>/)
  assert.match(list, /Nenhum fornecedor cadastrado/)
  assert.match(list, /Nenhum resultado encontrado/)
})

test('formulário segue o padrão de proteção contra perda de dados', () => {
  assert.match(form, /<FormHeader\s+module="Cadastros"/)
  assert.match(form, /back=\{\{ to: SUPPLIERS_PATH, label: 'Voltar para fornecedores' \}\}/)
  assert.match(form, /const \{ dirty, resetBaseline \} = useFormChanges\(values\)/)
  assert.match(form, /<FormExit to=\{SUPPLIERS_PATH\} blocked=\{saving\} dirty=\{dirty\}>/)
  assert.match(form, /<SavingForm[^>]*saving=\{saving\}/)
  assert.match(form, /useSaveAction\(\)/)
})

test('formulário valida antes de chamar a API e mostra o erro devolvido', () => {
  assert.match(form, /const errors = supplierFormErrors\(values\)/)
  assert.match(form, /if \(hasErrors\) return/)
  assert.match(form, /const payload = supplierPayload\(values\)/)
  assert.match(form, /await createSupplier\(payload\)/)
  assert.match(
    form,
    /await updateSupplier\(supplierId, \{\s*\.\.\.payload,\s*is_active: values\.isActive,\s*\}\)/,
  )
  assert.match(form, /setError\(\s*getErrorMessage\(/)
})

test('formulário tem telefone e e-mail opcionais com máscara e dica', () => {
  assert.match(form, /value=\{maskPhoneInput\(values\.phone\)\}/)
  assert.match(form, /value=\{maskTaxIdInput\(values\.document\)\}/)
  assert.match(form, /type="email"/)
  assert.match(form, /'Opcional\. Informe com DDD\.'/)
  assert.match(form, /'Opcional\.'/)
})

test('edição carrega o fornecedor e não revalida campos antigos intocados', () => {
  assert.match(form, /getSupplier\(supplierId\)/)
  assert.match(
    form,
    /const VALIDATED_ON_CHANGE: SupplierField\[\] = \['document', 'phone', 'email'\]/,
  )
  assert.match(form, /values\[field\] === loadedValues\[field\]\) delete errors\[field\]/)
  assert.match(form, /Fornecedor ativo/)
  assert.match(form, /Notas já registradas guardam o nome e o CPF\/CNPJ informados na época/)
})

test('após salvar, volta para a lista com confirmação', () => {
  assert.match(
    form,
    /announceSuccess\(editing \? 'Fornecedor atualizado\.' : 'Fornecedor cadastrado\.'\)/,
  )
  assert.match(form, /navigate\(SUPPLIERS_PATH, \{\s*replace: true,\s*\}\)/)
})

test('estilos da lista e das mensagens de campo existem', () => {
  for (const selector of [
    '.suppliers-table .data-table-row',
    '.suppliers-actions',
    '.supplier-field-message',
  ]) {
    assert.ok(styles.includes(selector), `faltando ${selector}`)
  }
})
