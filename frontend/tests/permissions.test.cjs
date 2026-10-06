const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = readFileSync(join(__dirname, '../src/utils/permissions.ts'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2023,
  },
}).outputText

const exported = {}
vm.runInNewContext(code, {
  exports: exported,
  Set,
})

const { hasPermission, isUserRole, PERMISSIONS } = exported

test('owner can perform every restricted action', () => {
  for (const permission of PERMISSIONS) {
    assert.equal(hasPermission('owner', permission), true)
  }
})

test('admin can manage the internal module without reading compensation', () => {
  for (const permission of PERMISSIONS) {
    const expected = permission !== 'employee_compensation:read'
    assert.equal(hasPermission('admin', permission), expected)
  }
})

test('management permissions follow the role matrix', () => {
  assert.equal(hasPermission('owner', 'management:read'), true)
  assert.equal(hasPermission('owner', 'employee_compensation:read'), true)

  assert.equal(hasPermission('admin', 'management:read'), true)
  assert.equal(hasPermission('admin', 'employees:manage'), true)
  assert.equal(hasPermission('admin', 'cost_centers:manage'), true)
  assert.equal(hasPermission('admin', 'employee_compensation:read'), false)

  assert.equal(hasPermission('member', 'management:read'), false)
})

test('member cannot perform restricted actions', () => {
  for (const permission of PERMISSIONS) {
    assert.equal(hasPermission('member', permission), false)
  }
})

test('missing roles are denied by default', () => {
  assert.equal(hasPermission(undefined, 'organization:update'), false)
  assert.equal(hasPermission(null, 'customer:delete'), false)
})

test('recognizes only supported roles', () => {
  assert.equal(isUserRole('owner'), true)
  assert.equal(isUserRole('admin'), true)
  assert.equal(isUserRole('member'), true)
  assert.equal(isUserRole('manager'), false)
})
