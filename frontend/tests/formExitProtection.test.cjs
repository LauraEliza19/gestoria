const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')

function transpile(source, jsx = false) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: jsx ? ts.JsxEmit.ReactJSX : undefined,
    },
  }).outputText
}

function loadUnsavedChangesHook() {
  let effect

  const reactMock = {
    createContext: () => ({}),
    useCallback: (callback) => callback,
    useContext: () => undefined,
    useEffect: (callback) => {
      effect = callback
    },
    useRef: (initial) => ({ current: initial }),
    useState: (initial) => [initial, () => {}],
  }

  const exports = {}
  const output = transpile(read('src/components/forms/useFormState.ts'))

  new Function('require', 'exports', output)(() => reactMock, exports)

  return {
    hook: exports.useUnsavedChangesWarning,
    getEffect: () => effect,
  }
}

function loadFormExit() {
  const output = transpile(read('src/components/forms/FormActions.tsx'), true)
  const exports = {}

  const jsxRuntime = {
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props }),
  }

  new Function('require', 'exports', output)((moduleName) => {
    if (moduleName === 'react/jsx-runtime') return jsxRuntime
    if (moduleName === 'lucide-react') return { LoaderCircle: 'LoaderCircle' }
    if (moduleName === 'react-router-dom') return { Link: 'Link' }
    if (moduleName === './useFormState') {
      return {
        UNSAVED_FORM_MESSAGE:
          'Existem alterações não salvas. Deseja sair e descartar essas alterações?',
      }
    }

    throw new Error(`Módulo inesperado: ${moduleName}`)
  }, exports)

  return exports.FormExit
}

test('dirty forms register and remove a beforeunload warning', () => {
  const previousWindow = global.window
  let registered
  let removed

  global.window = {
    addEventListener(name, listener) {
      assert.equal(name, 'beforeunload')
      registered = listener
    },
    removeEventListener(name, listener) {
      assert.equal(name, 'beforeunload')
      removed = listener
    },
  }

  try {
    const { hook, getEffect } = loadUnsavedChangesHook()

    hook(true)
    const cleanup = getEffect()()

    let prevented = false
    const event = {
      returnValue: null,
      preventDefault() {
        prevented = true
      },
    }

    registered(event)

    assert.equal(prevented, true)
    assert.equal(event.returnValue, '')
    cleanup()
    assert.equal(removed, registered)
  } finally {
    if (previousWindow === undefined) delete global.window
    else global.window = previousWindow
  }
})

test('clean forms do not register a beforeunload warning', () => {
  const previousWindow = global.window
  let registrations = 0

  global.window = {
    addEventListener() {
      registrations++
    },
    removeEventListener() {},
  }

  try {
    const { hook, getEffect } = loadUnsavedChangesHook()

    hook(false)
    const cleanup = getEffect()()

    assert.equal(cleanup, undefined)
    assert.equal(registrations, 0)
  } finally {
    if (previousWindow === undefined) delete global.window
    else global.window = previousWindow
  }
})

test('FormExit keeps the user on the form when discarding is rejected', () => {
  const previousWindow = global.window
  let confirmResult = false
  let confirmations = 0

  global.window = {
    confirm(message) {
      confirmations++
      assert.match(message, /alterações não salvas/i)
      return confirmResult
    },
  }

  try {
    const FormExit = loadFormExit()
    const exit = FormExit({
      to: '/clientes',
      dirty: true,
      children: 'Cancelar',
    })

    let prevented = false
    exit.props.onClick({
      preventDefault() {
        prevented = true
      },
    })

    assert.equal(prevented, true)

    confirmResult = true
    prevented = false
    exit.props.onClick({
      preventDefault() {
        prevented = true
      },
    })

    assert.equal(prevented, false)
    assert.equal(confirmations, 2)
  } finally {
    if (previousWindow === undefined) delete global.window
    else global.window = previousWindow
  }
})

test('FormExit calls button actions only after confirmation', () => {
  const previousWindow = global.window
  let confirmResult = false
  let calls = 0

  global.window = {
    confirm: () => confirmResult,
  }

  try {
    const FormExit = loadFormExit()
    const exit = FormExit({
      onClick: () => {
        calls++
      },
      dirty: true,
      children: 'Fechar',
    })

    exit.props.onClick()
    assert.equal(calls, 0)

    confirmResult = true
    exit.props.onClick()
    assert.equal(calls, 1)
  } finally {
    if (previousWindow === undefined) delete global.window
    else global.window = previousWindow
  }
})
