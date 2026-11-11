const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const accountsPage = read('src/pages/Finance/FinanceAccountsPage.tsx')
const entryForm = read('src/pages/Finance/FinanceEntryFormPage.tsx')
const auditPage = read('src/pages/Finance/FinanceAuditPage.tsx')
const financeService = read('src/services/finance.service.ts')
const router = read('src/app/router.tsx')
const layout = read('src/layouts/DashboardLayout.tsx')

test('rota de contas exige leitura financeira e aparece no menu', () => {
  assert.match(router, /path="\/financeiro\/contas"/)
  assert.match(router, /<FinanceAccountsPage \/>/)
  assert.match(layout, /to="\/financeiro\/contas"/)
})

test('serviço expõe vencimento, baixa e anexos', () => {
  assert.match(financeService, /due_date: string/)
  assert.match(financeService, /is_overdue: boolean/)
  assert.match(financeService, /\/settle`/)
  assert.match(financeService, /export function uploadFinanceAttachment/)
  assert.match(financeService, /export function downloadFinanceAttachment/)
  assert.match(financeService, /export function deleteFinanceAttachment/)
  assert.match(financeService, /encodeURIComponent\(file\.name\)/)
})

test('contas separam pagar e receber e ordenam por vencimento', () => {
  assert.match(accountsPage, /A pagar/)
  assert.match(accountsPage, /A receber/)
  assert.match(accountsPage, /sort: 'due_date'/)
  assert.match(accountsPage, /entry\.is_overdue \? 'Vencido'/)
})

test('baixa só aparece para pendentes e envia a versão', () => {
  assert.match(accountsPage, /can\('finance:manage'\) && entry\.status === 'pending'/)
  assert.match(accountsPage, /expected_version: entry\.version/)
  assert.match(accountsPage, /Confirmar baixa/)
})

test('formulário tem vencimento e anexos', () => {
  assert.match(entryForm, /due_date: dueDate/)
  assert.match(entryForm, /Vencimento/)
  assert.match(entryForm, /Adicionar comprovante/)
  assert.match(entryForm, /setQueuedFiles/)
  assert.match(entryForm, /uploadFinanceAttachment\(created\.id, file\)/)
  assert.match(entryForm, /ATTACHMENT_MAX_BYTES/)
})

test('auditoria nomeia baixa e anexos', () => {
  assert.match(financeService, /entry_settled: 'Baixa'/)
  assert.match(financeService, /attachment_added: 'Anexo incluído'/)
  assert.match(auditPage, /financeEventLabels\[event\.event_type\]/)
  assert.match(entryForm, /financeEventLabels\[event\.event_type\]/)
})

test('formulário avisa quando não há categoria e leva ao cadastro', () => {
  assert.match(entryForm, /Nenhuma categoria cadastrada/)
  assert.match(entryForm, /to="\/financeiro\/categorias\/nova"/)
})

test('baixa permite enviar comprovante junto', () => {
  assert.match(accountsPage, /Comprovante \(opcional\)/)
  assert.match(accountsPage, /uploadFinanceAttachment\(entry\.id, file\)/)
  assert.match(accountsPage, /Baixa registrada, mas o comprovante não foi enviado/)
})
