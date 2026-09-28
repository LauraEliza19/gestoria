const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = readFileSync(join(__dirname, '../src/utils/errors.ts'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2023,
  },
}).outputText

const exported = {}
vm.runInNewContext(code, { exports: exported, Error })

const { DEFAULT_ERROR_MESSAGE, getErrorMessage } = exported

test('uses the message from an Error instance', () => {
  assert.equal(getErrorMessage(new Error('Falha específica.')), 'Falha específica.')
})

test('removes surrounding whitespace from error messages', () => {
  assert.equal(getErrorMessage(new Error('  Falha específica.  ')), 'Falha específica.')
})

test('uses the default message for unknown or empty errors', () => {
  assert.equal(getErrorMessage(null), DEFAULT_ERROR_MESSAGE)
  assert.equal(getErrorMessage(new Error('   ')), DEFAULT_ERROR_MESSAGE)
})

test('accepts a contextual fallback message', () => {
  assert.equal(
    getErrorMessage({}, 'Não foi possível carregar os pedidos.'),
    'Não foi possível carregar os pedidos.',
  )
})
