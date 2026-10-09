import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
function compile(file) {
  return ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
}
const identifiers = {}
vm.runInNewContext(compile('loginIdentifier.ts'), { exports: identifiers })
function harness(failVerification = false) {
  const states = [], refs = [], calls = []
  let cursor = 0, refCursor = 0, tree
  const exports = {}
  const auth = {
    async updateUser(args) { calls.push(['updateUser', args]); return { error: null } },
    async verifyOtp(args) { calls.push(['verifyOtp', args]); return { error: failVerification ? {} : null } },
  }
  vm.runInNewContext(compile('PhoneAccess.tsx'), { exports, require(name) {
    if (name === './loginIdentifier') return identifiers
    if (name === 'react') return {
      useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value }] },
      useRef(initial) { const index = refCursor++; return refs[index] ??= { current: initial } },
    }
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
    throw Error(name)
  } })
  function render() { cursor = refCursor = 0; tree = exports.default({ client: { auth } }) }
  function nodes(node = tree) {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(nodes)
    return [node, ...nodes(node.props?.children ?? null)]
  }
  render()
  return {
    calls,
    fill(index, value) { nodes().filter(n => n.type === 'input')[index].props.onChange({ target: { value } }); render() },
    async submit() { nodes().find(n => n.type === 'button').props.onClick(); await new Promise(r => setTimeout(r, 0)); render() },
    text() { return JSON.stringify(tree) },
  }
}
test('phone access links the current account and verifies the exact sent number before success', async () => {
  const ui = harness()
  ui.fill(0, '099123456'); await ui.submit(); assert.equal(ui.calls.length, 0)
  ui.fill(0, '+598 99 123 456'); await ui.submit()
  assert.equal(ui.calls[0][0], 'updateUser')
  assert.equal(ui.calls[0][1].phone, '+59899123456')
  ui.fill(1, '123'); await ui.submit(); assert.equal(ui.calls.length, 1)
  ui.fill(1, '123456'); await ui.submit()
  assert.equal(ui.calls[1][1].type, 'phone_change')
  assert.equal(ui.calls[1][1].phone, '+59899123456')
  assert.match(ui.text(), /Celular verificado/)
})
test('a rejected verification never claims that phone login is available', async () => {
  const ui = harness(true)
  ui.fill(0, '+59899123456'); await ui.submit()
  ui.fill(1, '123456'); await ui.submit()
  assert.match(ui.text(), /no pudo verificarse/)
  assert.doesNotMatch(ui.text(), /Celular verificado/)
})
