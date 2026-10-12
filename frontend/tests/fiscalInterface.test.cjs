const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const utils = read('src/pages/Fiscal/fiscalUtils.ts')
const page = read('src/pages/Fiscal/FiscalDocumentsPage.tsx')
const list = read('src/pages/Fiscal/FiscalDocumentList.tsx')
const overview = read('src/pages/Fiscal/FiscalDocumentOverview.tsx')
const statusForm = read('src/pages/Fiscal/FiscalStatusForm.tsx')
const history = read('src/pages/Fiscal/FiscalHistory.tsx')
const styles = read('src/styles/tailwind.css')

test('fiscal UI defines all supported visual statuses', () => {
  for (const status of [
    'Em processamento',
    'Autorizada',
    'Rejeitada',
    'Cancelada',
    'Inutilizada',
    'Denegada',
  ]) {
    assert.ok(utils.includes(`'${status}'`), `status ${status} should exist`)
    assert.ok(utils.includes(`label: '${status}'`), `metadata for ${status} should exist`)
  }
})

test('status badges are reused in list, details and history', () => {
  assert.match(utils, /export function fiscalStatusClass\(status: string\)/)
  assert.match(list, /fiscalStatusClass\(document\.status\)/)
  assert.match(overview, /fiscalStatusClass\(document\.status\)/)
  assert.match(overview, /statusMeta\.description/)
  assert.match(history, /fiscalStatusClass\(event\.detail\.status\)/)
  for (const tone of ['processing', 'success', 'danger', 'warning', 'neutral']) {
    assert.ok(styles.includes(`.fiscal-status-${tone}`), `missing ${tone} status style`)
  }
})

test('fiscal page exposes accessible success and error feedback', () => {
  assert.match(page, /className="fiscal-feedback fiscal-feedback-success"/)
  assert.match(page, /className="fiscal-feedback fiscal-feedback-error"/)
  assert.match(page, /role="status"/)
  assert.match(page, /role="alert"/)
})

test('status flow collects required external evidence', () => {
  assert.match(statusForm, /type="datetime-local"/)
  assert.match(statusForm, /required=\{needsProtocol\}/)
  assert.match(statusForm, /minLength=\{3\}/)
  assert.match(statusForm, /Registrar evento/)
  assert.match(statusForm, /Registre somente um evento que já tenha ocorrido/)
})

test('history displays action, timestamp, actor and reason', () => {
  assert.match(history, /Histórico de ações/)
  assert.match(history, /FISCAL_ACTION_NAMES\[event\.action\]/)
  assert.match(history, /formatFiscalDateTime\(event\.created_at\)/)
  assert.match(history, /event\.actor_id/)
  assert.match(history, /event\.detail\.reason/)
  assert.match(page, /<FiscalHistory events=\{selected\.events\}/)
})

test('detail close button has reserved space and cannot overlap status', () => {
  assert.match(page, /className="detail-close"/)
  assert.match(styles, /\.fiscal-detail\s*\{\s*@apply relative mt-5 pt-12;/)
  assert.match(styles, /\.fiscal-detail-title\s*\{[^}]*md:pr-24/s)
})

test('fiscal UI clearly states that external authorization is not performed here', () => {
  assert.match(page, /autorização fiscal dependem de um serviço externo/)
})
