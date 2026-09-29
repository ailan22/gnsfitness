import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the real component handlers with an isolated hook renderer and Auth stub.
// No mail is sent and no live credential is changed.
const source = readFileSync(new URL('../src/PasswordRecovery.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText
const recoveryExports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/recoveryUrl.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: recoveryExports, URL })

function harness({ authenticated = false, invalidLink = false, checking = false, failure = null, throws = false } = {}) {
  const states = []
  let cursor = 0
  let tree
  const calls = []
  const exports = {}
  const auth = Object.fromEntries(['resetPasswordForEmail', 'updateUser'].map(method => [method, async (...args) => {
    calls.push({ method, args })
    if (throws) throw new Error('network unavailable')
    return { error: failure }
  }]))
  vm.runInNewContext(compiled, {
    exports, URL, window: { location: { origin: 'http://localhost:5173' } },
    require(name) {
      if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => false } }
      if (name === './recoveryUrl') return recoveryExports
      if (name === 'react') return { useState(initial) {
        const index = cursor++
        if (!(index in states)) states[index] = initial
        return [states[index], value => { states[index] = value }]
      } }
      if (name === 'react/jsx-runtime') return {
        Fragment: 'fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }),
      }
      throw new Error(`Unexpected dependency: ${name}`)
    },
  })
  function render() { cursor = 0; tree = exports.default({ client: { auth }, authenticated, invalidLink, checking }) }
  function nodes(node = tree) {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(nodes)
    return [node, ...nodes(node.props?.children ?? null)]
  }
  render()
  return {
    calls,
    fill(index, value) { nodes().filter(node => node.type === 'input')[index].props.onChange({ target: { value } }); render() },
    async submit() { await nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); render() },
    text() { return JSON.stringify(tree) },
    inputs() { return nodes().filter(node => node.type === 'input') },
  }
}

test('signed-out recovery sends to the current app callback and prevents duplicate sends', async () => {
  const ui = harness()
  ui.fill(0, ' member@example.test ')
  await ui.submit()
  assert.equal(ui.calls[0].method, 'resetPasswordForEmail')
  assert.equal(ui.calls[0].args[0], 'member@example.test')
  assert.equal(ui.calls[0].args[1].redirectTo, 'http://localhost:5173/reset-password')
  assert.match(ui.text(), /Si el correo corresponde/)
  await ui.submit()
  assert.equal(ui.calls.length, 1)
})

test('invalid callback cannot expose the password form even with an existing session', () => {
  const ui = harness({ authenticated: true, invalidLink: true })
  assert.equal(ui.inputs()[0].props.type, 'email')
  assert.match(ui.text(), /El enlace no es válido/)
})

test('pending authentication exposes no credential fields', () => {
  assert.equal(harness({ checking: true, authenticated: true }).inputs().length, 0)
})

test('password mismatch makes no Auth update', async () => {
  const ui = harness({ authenticated: true })
  ui.fill(0, 'test-password-A1!'); ui.fill(1, 'test-password-B2!')
  await ui.submit()
  assert.equal(ui.calls.length, 0)
  assert.match(ui.text(), /no coinciden/)
})

test('short password makes no Auth update', async () => {
  const ui = harness({ authenticated: true })
  ui.fill(0, 'short'); ui.fill(1, 'short')
  await ui.submit()
  assert.equal(ui.calls.length, 0)
  assert.match(ui.text(), /al menos 12/)
})

test('successful Auth update shows confirmation and removes credential fields', async () => {
  const ui = harness({ authenticated: true })
  ui.fill(0, 'test-password-A1!'); ui.fill(1, 'test-password-A1!')
  await ui.submit()
  assert.equal(ui.calls[0].method, 'updateUser')
  assert.equal(ui.calls[0].args[0].password, 'test-password-A1!')
  assert.match(ui.text(), /se guardó correctamente/)
  assert.equal(ui.inputs().length, 0)
  assert.doesNotMatch(ui.text(), /test-password-A1/)
})

test('expired session clears fields and offers a new recovery link', async () => {
  const ui = harness({ authenticated: true, failure: { status: 401, code: 'session_not_found' } })
  ui.fill(0, 'test-password-A1!'); ui.fill(1, 'test-password-A1!')
  await ui.submit()
  assert.match(ui.text(), /sesión de recuperación venció/)
  assert.doesNotMatch(ui.text(), /se guardó correctamente/)
  assert.ok(ui.inputs().every(input => input.props.value === ''))
})

test('mail rate limit is reported without claiming delivery', async () => {
  const ui = harness({ failure: { status: 429 } })
  ui.fill(0, 'member@example.test'); await ui.submit()
  assert.match(ui.text(), /Esperá unos minutos/)
  assert.doesNotMatch(ui.text(), /Solicitud enviada/)
})

test('network failure does not claim a password change', async () => {
  const ui = harness({ authenticated: true, throws: true })
  ui.fill(0, 'test-password-A1!'); ui.fill(1, 'test-password-A1!')
  await ui.submit()
  assert.match(ui.text(), /No se pudo confirmar el cambio/)
  assert.ok(ui.inputs().every(input => input.props.value === ''))
})
