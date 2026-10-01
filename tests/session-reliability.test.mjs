import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
const compiled = ts.transpileModule(readFileSync(new URL('../src/CloudSessionRecorder.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
const insertApi = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/confirmedInsert.ts', import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:insertApi,Error})
function harness({ lostResponse = false, lookupFailure = false } = {}) {
  const states = []; let cursor = 0; let tree; let saved = 0; let inserts = 0; let stored = false
  const exports = {}
  const client = { from() { return {
    select() { return this }, eq() { return this },
    async maybeSingle() { if (lookupFailure) throw Error('offline'); return { data: stored || null, error: null } },
    insert(row) { inserts++; assert.equal(row.id, 'request-1'); stored = {...row}; return { select() { return { async single() { if (lostResponse) throw Error('response lost'); return { data: { id: row.id }, error: null } } } } } },
  } } }
  vm.runInNewContext(compiled, { exports, Error, crypto: { randomUUID: () => 'request-1' }, require(name) {
    if (name === 'react') return { useRef(initial) {const i=cursor++;return states[i] ??= {current:initial}}, useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = value }] } }
    if (name === './confirmedInsert') return insertApi
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
    if (name === './readAllPages') return { readAllPages() { throw Error('Unexpected suggested-day query') } }
    if (name === './membership') return { parseDay: () => true }
    if (name === './cloudTraining') return {}
    throw Error(name)
  } })
  function render() { cursor = 0; tree = exports.default({ client, memberId: 'member-1', routines: [], sessions: [], suggested: false, onSaved: () => { saved++ }, onCancel() {} }) }
  function nodes(node = tree) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(item => nodes(item ?? null)); return [node, ...nodes(node.props?.children ?? null)] }
  render()
  return { changeNotes(value) {nodes().find(n=>n.type==='textarea').props.onChange({target:{value}});render()}, async submit() { nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await new Promise(r => setTimeout(r, 10)); render() }, text: () => JSON.stringify(tree), saving: () => nodes().find(n => n.type === 'fieldset').props.disabled, counts: () => ({ saved, inserts }) }
}
test('lost insert response can be retried without recording another session', async () => {
  const ui = harness({ lostResponse: true }); await ui.submit()
  assert.equal(ui.saving(), false)
  assert.deepEqual(ui.counts(), { saved: 1, inserts: 1 })
  await ui.submit(); assert.deepEqual(ui.counts(), { saved: 2, inserts: 1 })
})

test('retry with changed notes cannot claim the changes were saved',async()=>{
 const ui=harness({lostResponse:true});await ui.submit();ui.changeNotes('New unsaved notes');await ui.submit()
 assert.deepEqual(ui.counts(),{saved:1,inserts:1});assert.match(ui.text(),/otros datos/);assert.match(ui.text(),/New unsaved notes/)
})
test('failed lookup unlocks the form and never inserts unverified data', async () => {
  const ui = harness({ lookupFailure: true }); await ui.submit()
  assert.equal(ui.saving(), false); assert.deepEqual(ui.counts(), { saved: 0, inserts: 0 })
})
test('successful insert reports completion', async () => {
  const ui = harness(); await ui.submit(); assert.deepEqual(ui.counts(), { saved: 1, inserts: 1 }); assert.equal(ui.saving(), false)
})




