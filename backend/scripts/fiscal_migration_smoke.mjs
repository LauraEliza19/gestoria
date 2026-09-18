// Executes Alembic's real exported SQL on embedded PostgreSQL/WASM.
// This does NOT validate network-driver integration or concurrent PG transactions.
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const dir = resolve(process.argv[2])
const { PGlite } = await import(pathToFileURL(resolve(dir, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const before = await readFile(resolve(dir, 'before.sql'), 'utf8')
const upgrade = await readFile(resolve(dir, 'upgrade.sql'), 'utf8')
const downgrade = await readFile(resolve(dir, 'downgrade.sql'), 'utf8')
const db = new PGlite()
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const seed = `
INSERT INTO organizations(id,name,slug) VALUES ('${id(1)}','Empresa A','a'), ('${id(2)}','Empresa B','b');
INSERT INTO users(id,full_name,email,password_hash,is_active) VALUES ('${id(3)}','Ator','ator@example.test','not-a-login',true);
INSERT INTO customers(id,organization_id,name,phone,is_active) VALUES ('${id(4)}','${id(1)}','Cliente A','1',true), ('${id(5)}','${id(2)}','Cliente B','2',true);
INSERT INTO orders(id,organization_id,customer_id,status,total_amount) VALUES ('${id(6)}','${id(1)}','${id(4)}','completed',10), ('${id(7)}','${id(2)}','${id(5)}','completed',10);
`
function oldDoc(n, order = null, number = String(n), status = 'Autorizada', direction = 'saida') {
  return `INSERT INTO fiscal_documents(id,organization_id,order_id,document_type,number,participant_name,issue_date,value,status) VALUES ('${id(n)}','${id(1)}',${order ? `'${id(order)}'` : 'NULL'},'${direction}','${number}','Cliente A','2025-01-01',10,'${status}');`
}
async function reset() { await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); await db.exec(before); await db.exec(seed) }
async function rejected(sql, regex) {
  let failure
  try { await db.exec(sql) } catch (e) { failure = e; await db.exec('ROLLBACK;') }
  assert.ok(failure, 'Expected database rejection')
  assert.match(failure.message, regex)
}
async function scalar(sql) { return Object.values((await db.query(sql)).rows[0])[0] }
const results = []
async function test(name, action) { await reset(); await action(); results.push({ name, passed: true }); console.log(`PASS ${name}`) }
await test('empty upgrade/downgrade/upgrade', async () => {
  await db.exec(upgrade); await db.exec(downgrade); await db.exec(upgrade)
  assert.equal(await scalar('SELECT version_num FROM alembic_version'), '0006_fiscal_integrity')
})
await test('legacy data preserved without fabricated actor/date/items', async () => {
  await db.exec(oldDoc(10)); await db.exec(upgrade)
  const row = (await db.query('SELECT * FROM fiscal_documents')).rows[0]
  assert.equal(row.is_legacy, true); assert.equal(row.created_by_id, null); assert.equal(row.authorized_at, null)
  assert.equal(row.order_id, null); assert.equal(Number(row.value), 10); assert.equal(row.status, 'Autorizada')
  assert.equal(await scalar('SELECT count(*)::int FROM fiscal_document_items'), 0)
  await db.exec(downgrade)
  assert.equal(await scalar('SELECT count(*)::int FROM fiscal_documents'), 1)
})
for (const [name, data, regex] of [
  ['duplicate active orders abort atomically', oldDoc(10, 6) + oldDoc(11, 6), /multiple active/],
  ['duplicate numbering aborts atomically', oldDoc(10, null, '10') + oldDoc(11, null, '10', 'Cancelada'), /duplicate outgoing/],
  ['cross-tenant order aborts atomically', oldDoc(10, 7), /invalid or cross-tenant/],
  ['incoming sales-order link aborts atomically', oldDoc(10, 6, '10', 'Autorizada', 'entrada'), /invalid or cross-tenant/],
]) await test(name, async () => {
  await db.exec(data); const count = await scalar('SELECT count(*)::int FROM fiscal_documents')
  await rejected(upgrade, regex)
  assert.equal(await scalar('SELECT version_num FROM alembic_version'), '0005_fiscal_documents')
  assert.equal(await scalar('SELECT count(*)::int FROM fiscal_documents'), count)
  assert.equal(await scalar("SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='suppliers'"), 0)
})
await test('partial uniqueness, tenant FK and preservation after cancellation', async () => {
  await db.exec(oldDoc(10, 6)); await db.exec(upgrade)
  const native = (n, order, number = String(n)) => `INSERT INTO fiscal_documents(id,organization_id,order_id,customer_id,created_by_id,updated_by_id,document_type,number,participant_name,issue_date,value,snapshot_source) VALUES ('${id(n)}','${id(1)}',${order ? `'${id(order)}'` : 'NULL'},'${id(4)}','${id(3)}','${id(3)}','saida','${number}','Cliente A','2025-01-01',10,'order');`
  await rejected(native(11, 6), /uq_fiscal_active_order/)
  await rejected(native(11, 7), /fk_fiscal_order_org/)
  await rejected(native(11, null), /ck_fiscal_required_links/)
  await rejected(`DELETE FROM orders WHERE id='${id(6)}'`, /fk_fiscal_order_org/)
  await db.exec(`UPDATE fiscal_documents SET status='Cancelada' WHERE id='${id(10)}'`)
  await rejected(native(11, 6, '10'), /uq_fiscal_outgoing_number/)
  await db.exec(native(11, 6))
  assert.equal(await scalar('SELECT count(*)::int FROM fiscal_documents'), 2)
  await rejected(downgrade, /downgrade blocked/)
  assert.equal(await scalar('SELECT version_num FROM alembic_version'), '0006_fiscal_integrity')
})
const report = { runtime: 'PGlite (embedded PostgreSQL/WASM; not concurrent server validation)', version: await scalar('SELECT version()'), tests: results, total: results.length, passed: results.length }
await writeFile(resolve(dir, 'migration-smoke-results.json'), JSON.stringify(report, null, 2) + '\n')
await db.close()
