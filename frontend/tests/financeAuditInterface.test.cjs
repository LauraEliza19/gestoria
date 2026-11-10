const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const auditPage = read('src/pages/Finance/FinanceAuditPage.tsx')
const financePage = read('src/pages/Finance/FinancePage.tsx')
const financeService = read('src/services/finance.service.ts')
const router = read('src/app/router.tsx')

test('auditoria financeira apresenta os filtros operacionais', () => {
  assert.match(auditPage, /Auditoria financeira/)
  assert.match(auditPage, /Lançamento ou ID/)
  assert.match(auditPage, /Usuário responsável/)
  assert.match(auditPage, /Data inicial da alteração/)
  assert.match(auditPage, /Data final da alteração/)
  assert.match(auditPage, /Valor anterior contém/)
  assert.match(auditPage, /Valor novo contém/)
})

test('auditoria envia todos os filtros para o serviço', () => {
  assert.match(auditPage, /page:\s*requestedPage/)
  assert.match(auditPage, /page_size:\s*AUDIT_PAGE_SIZE/)
  assert.match(auditPage, /getFinanceAudit\(\{/)
  assert.match(auditPage, /query:\s*query\.trim\(\) \|\| undefined/)
  assert.match(auditPage, /actor:\s*actor\.trim\(\) \|\| undefined/)
  assert.match(auditPage, /start_date:\s*startDate \|\| undefined/)
  assert.match(auditPage, /end_date:\s*endDate \|\| undefined/)
  assert.match(auditPage, /before_value:\s*beforeValue\.trim\(\) \|\| undefined/)
  assert.match(auditPage, /after_value:\s*afterValue\.trim\(\) \|\| undefined/)
})

test('auditoria possui estados de carregamento erro e resultado vazio', () => {
  assert.match(auditPage, /Consultando histórico financeiro/)
  assert.match(auditPage, /role="alert"/)
  assert.match(auditPage, /Nenhum evento encontrado para os filtros informados/)
  assert.match(auditPage, /disabled=\{loading\}/)
})

test('linha do tempo identifica responsável versão e alterações', () => {
  assert.match(auditPage, /event\.actor_name/)
  assert.match(auditPage, /Versão \{event\.version\}/)
  assert.match(auditPage, /displayValue\(field, change\.before\)/)
  assert.match(auditPage, /displayValue\(field, change\.after\)/)
  assert.match(auditPage, /Abrir lançamento/)
})

test('auditoria consome resposta paginada e oferece navegação', () => {
  assert.match(auditPage, /setEvents\(result\.items\)/)
  assert.match(auditPage, /setTotal\(result\.total\)/)
  assert.match(auditPage, /setPage\(result\.page\)/)
  assert.match(auditPage, /setHasNext\(result\.has_next\)/)
  assert.match(auditPage, /Anterior/)
  assert.match(auditPage, /Próxima/)
  assert.match(auditPage, /disabled=\{loading \|\| page <= 1\}/)
  assert.match(auditPage, /disabled=\{loading \|\| !hasNext\}/)
  assert.match(auditPage, /eventos encontrados/)
})

test('serviço financeiro usa o endpoint autenticado de auditoria', () => {
  assert.match(financeService, /export type FinanceAuditSearchPage/)
  assert.match(financeService, /items: FinanceAuditSearchEvent\[\]/)
  assert.match(financeService, /total: number/)
  assert.match(financeService, /page_size: number/)
  assert.match(financeService, /has_next: boolean/)
  assert.match(financeService, /apiFetch<FinanceAuditSearchPage>/)
  assert.match(financeService, /export function getFinanceAudit/)
  assert.match(financeService, /\/api\/finance\/audit/)
  assert.match(financeService, /before_value/)
  assert.match(financeService, /after_value/)
})

test('auditoria exige permissão específica e oculta o atalho sem autorização', () => {
  assert.match(financePage, /can\('finance:audit'\)/)
  assert.match(financePage, /to="\/financeiro\/auditoria"/)
  assert.match(financePage, /Histórico de auditoria/)
  assert.match(router, /path="\/financeiro\/auditoria"/)
  assert.match(router, /permission="finance:audit"/)
  assert.match(router, /<FinanceAuditPage \/>/)
})
