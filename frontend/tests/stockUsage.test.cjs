const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')
const source = readFileSync(join(__dirname, '../src/pages/FactoryMode/stockUsage.ts'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText
const exported = {}
vm.runInNewContext(code, { exports: exported })
const { parseUsage, friendlyAmount } = exported

test('accepts grams and natural phrases for stock stored in kg', () => {
  for (const input of ['800g', '800 gramas', 'usei 800 g', '800', '0,8 kg', '0.8kg']) {
    assert.equal(parseUsage(input, 'kg', '2').quantity, '0.800', input)
  }
  assert.equal(parseUsage('meio quilo', 'kg', '2').quantity, '0.500')
  assert.equal(parseUsage('UM QUILO', 'g', '2000').quantity, '1000.000')
  assert.equal(parseUsage('metade', 'kg', '2').quantity, '1.000')
  assert.equal(parseUsage('tudo', 'kg', '2').quantity, '2.000')
})
test('accepts volume, decimal commas, thousands and units', () => {
  assert.equal(parseUsage('250 ml', 'L', '2').quantity, '0.250')
  assert.equal(parseUsage('meio litro', 'ml', '2000').quantity, '500.000')
  assert.equal(parseUsage('1,5 litros', 'L', '2').quantity, '1.500')
  assert.equal(parseUsage('1.500 g', 'kg', '2').quantity, '1.500')
  assert.equal(parseUsage('1.500,5 g', 'g', '2000').quantity, '1500.500')
  assert.equal(parseUsage('2 unidades', 'un', '12').quantity, '2.000')
})
test('rejects incompatible, ambiguous, invalid or excessive quantities', () => {
  for (const input of [
    '800 ml',
    '1 xícara',
    '-1 g',
    '0',
    'NaN',
    '1e3 g',
    '3kg',
    '800g lixo',
    '1/2 kg',
    '',
  ]) {
    assert.ok(parseUsage(input, 'kg', '2').error, input)
  }
})
test('does not round consumption silently', () => {
  assert.ok(parseUsage('0,5 g', 'kg', '2').error)
  assert.ok(parseUsage('metade', 'kg', '0.001').error)
  assert.equal(parseUsage('1 g', 'kg', '0.001').quantity, '0.001')
  assert.equal(parseUsage('0,001 g', 'g', '2').quantity, '0.001')
  assert.equal(parseUsage('tudo', 'kg', '1000000000').quantity, '1000000000.000')
})
test('shows practical units and parses slider values without losing precision', () => {
  assert.equal(friendlyAmount('0.8', 'kg'), '800 g')
  assert.equal(friendlyAmount('0.25', 'L'), '250 ml')
  assert.equal(friendlyAmount('1', 'un'), '1 unidade')
  for (const unit of ['g', 'kg', 'ml', 'L', 'un']) {
    for (const value of ['0.001', '0.125', '0.8', '1.234', '1234.567', '1000000000']) {
      assert.equal(
        parseUsage(friendlyAmount(value, unit), unit, '1000000000').quantity,
        Number(value).toFixed(3),
      )
    }
  }
})
