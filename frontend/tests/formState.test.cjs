const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const source = fs.readFileSync(
  path.join(__dirname, '../src/components/forms/useFormState.ts'),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})

function mountHook(name, ...initialArgs) {
  const slots = []
  let cursor = 0

  function slot(initial) {
    const index = cursor++
    if (index === slots.length) slots.push(initial)
    return index
  }

  const react = {
    createContext: () => ({}),
    useRef: (initial) => slots[slot({ current: initial })],
    useCallback: (callback) => callback,
    useState(initial) {
      const index = slot(initial)
      return [slots[index], (next) => (slots[index] = next)]
    },
  }
  const exports = {}
  new Function('require', 'exports', outputText)(() => react, exports)

  function render(...args) {
    cursor = 0
    return exports[name](...args)
  }

  return { initial: render(...initialArgs), render }
}

test('a repeated save in the same render sends a single request', async () => {
  const { initial, render } = mountHook('useSaveAction')
  const request = Promise.withResolvers()
  let calls = 0
  async function save() {
    calls++
    await request.promise
  }

  const first = initial.run(save, 'confirm')
  await initial.run(save)
  await render().run(save, 'cancel')

  assert.equal(calls, 1)
  assert.equal(initial.isBusy(), true)
  assert.equal(render().pendingAction, 'confirm')
  request.resolve()
  await first
  assert.equal(render().busy, false)
})

test('a failed request unlocks the form for another attempt', async () => {
  const { initial, render } = mountHook('useSaveAction')
  await assert.rejects(
    initial.run(async () => {
      throw new Error('Falha ao salvar')
    }),
    /Falha ao salvar/,
  )

  assert.equal(initial.isBusy(), false)
  assert.equal(render().pendingAction, null)
  let retried = false
  await render().run(async () => {
    retried = true
  })
  assert.equal(retried, true)
})

test('loaded and reset form values establish the baseline for unsaved changes', () => {
  const empty = { name: '', items: [] }
  const loaded = { name: 'Receita', items: [{ amount: '1' }] }
  const changed = { ...loaded, items: [{ amount: '2' }] }
  const { initial, render } = mountHook('useFormChanges', empty)
  assert.equal(initial.dirty, false)

  initial.resetBaseline(loaded)
  assert.equal(render(loaded).dirty, false)
  assert.equal(render(changed).dirty, true)
  assert.equal(render(loaded).dirty, false)

  render(changed).resetBaseline(empty)
  assert.equal(render(empty).dirty, false)
})
