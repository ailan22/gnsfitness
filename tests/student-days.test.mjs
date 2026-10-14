import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
const compile = file => ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } }).outputText
const training = {}
vm.runInNewContext(compile('cloudTraining.ts'), { exports: training })
function harness({ empty = false, sessions = [], failure = null, status = 'Activo', sessionTests = {} } = {}) {
  const routine = { id: 'routine', name: 'Plan personal', days_per_week: 3, program_rounds: 2, block_rounds: 2, plan: { exercisesByDay: Object.fromEntries([1,2,3].map(day => [day, empty ? [] : [{ id: 'exercise', name: 'Sentadilla', sets: '3', reps: '10' }]])) } }
  routine.plan.sessionTests = sessionTests
  const history = { member: { id: 'member', first_name: 'Alumna', status, welcome_form: 'Bienvenida' }, routines: [routine], sessions, reviews: [] }
  const states = [], refs = [], calls = []
  let cursor = 0, refCursor = 0, tree
  const exports = {}
  vm.runInNewContext(compile('CloudStudent.tsx'), { exports, window: { confirm: () => true }, crypto: { randomUUID: () => 'request-id' },
    require(name) {
      if (name === './ProtectedNutrition') return { default: ({children}) => children }
      if (name === './StudentCards.css') return {}
      if (name === './assets/student-home-full-photo-oct13.png') return { default: '/test-training.png' }
      if (['./GnsMethod','./ProgramResults'].includes(name)) return { default: () => null }
      if (name === './PlanNotifications') return { default: () => null }
      if (name === './StudentWellbeing') return { StudentWellbeing: () => null }
      if (name === './cloudTraining') return training
      if (name === './readAllPages') return {}
      if (name === 'react') return {
        useEffect() {},
        useRef(value) { const i = refCursor++; return refs[i] ??= { current: value } },
        useState(initial) { const i = cursor++; if (!(i in states)) states[i] = i === 2 ? history : i === 3 ? false : typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
      }
      if (name === 'react/jsx-runtime') return { Fragment: 'fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
      throw Error(name)
    },
  })
  const client = { async rpc(name, args) { calls.push({name,args}); return { error: failure } } }
  function render() { cursor = 0; refCursor = 0; tree = exports.default({ client, user: { id: 'student' } }) }
  function nodes(node = tree) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(child => nodes(child ?? null)); return [node, ...nodes(node.props?.children ?? null)] }
  const text = node => JSON.stringify(node)
  render()
  return { calls, nodes, render, text: () => text(tree),
    cards: () => nodes().filter(n => n.type === 'section' && /card student-day/.test(n.props.className ?? '')),
    begin() { const button = nodes().find(n => n.type === 'button' && !n.props.disabled && text(n.props.children).includes('Completar Día')); assert.ok(button); button.props.onClick(); render() },
    history() { nodes().find(n => n.type === 'details' && n.props.className === 'student-history-panel card').props.onToggle({currentTarget:{open:true}}); render() },
    field(label, value) { const input = nodes().find(n => n.type === 'input' && n.props['aria-label']?.startsWith(label)); input.props.onChange({ target: { value } }); render() },
    async save() { await nodes().find(n => n.type === 'form').props.onSubmit({preventDefault(){}}); await new Promise(resolve => setImmediate(resolve)); render() },
  }
}
const record = day => ({id:`session-${day}`, routine_id:'routine', routine_name:'Plan personal', day, performed_at:'2026-01-01', created_at:`2026-01-01T0${day}:00:00Z`, notes:'Registro conservado', results:[]})

test('progress reflects persisted training, not opening a card or entering loads', () => {
 const empty=harness()
 const bar=()=>empty.nodes().find(n=>n.type==='progress')
 assert.equal(bar().props.max,6)
 assert.equal(bar().props.value,0)
 empty.begin(); empty.field('Kilos utilizados','20')
 assert.equal(bar().props.value,0)
 const saved=harness({sessions:[record(1)]})
 assert.equal(saved.nodes().find(n=>n.type==='progress').props.value,1)
})

test('assigned test is labelled and appears only on its exact planned day',()=>{
 const ui=harness({sessionTests:{1:{2:[{id:'test',title:'Movilidad',details:'Evaluación supervisada'}]}}})
 assert.doesNotMatch(JSON.stringify(ui.cards()[0]),/Evaluación supervisada/)
 assert.match(JSON.stringify(ui.cards()[1]),/Evaluación supervisada/)
 assert.match(JSON.stringify(ui.cards()[1]),/Prueba/)
 assert.doesNotMatch(JSON.stringify(ui.cards()[2]),/Evaluación supervisada/)
})
test('standalone test day can be recorded and preserves its identity in history notes',async()=>{
 const ui=harness({empty:true,sessionTests:{1:{1:[{id:'test',title:'Evaluación mensual',details:'Movilidad supervisada'}]}}})
 assert.match(ui.text(),/Día de prueba/)
 assert.equal(ui.nodes(ui.cards()[0]).find(n=>n.type==='button').props.disabled,false)
 ui.begin(); await ui.save()
 assert.equal(ui.calls.length,1)
 assert.match(ui.calls[0].args.p_notes,/Día de prueba: Evaluación mensual/)
 assert.equal(ui.calls[0].args.p_results.length,0)
 assert.equal(ui.calls[0].args.p_expected_day,1)
})
test('first day can be completed from its card while later days remain locked', () => {
 const ui = harness()
 assert.match(JSON.stringify(ui.cards()[0]), /Disponible/)
 assert.equal(ui.nodes(ui.cards()[0]).find(n=>n.type==='button').props.disabled, false)
 assert.equal(ui.nodes(ui.cards()[1]).find(n=>n.type==='button').props.disabled, true)
 ui.begin()
 assert.match(ui.text(), /Guardar y completar día/)
 assert.match(JSON.stringify(ui.cards()[1]), /Bloqueado/)
})
test('empty day three has a visible disabled button and preserves previous records', () => {
 const ui = harness({empty:true, sessions:[record(2),record(1)]})
 const day = ui.cards()[2]
 assert.match(JSON.stringify(day), /Disponible/)
 assert.equal(ui.nodes(day).find(n=>n.type==='button').props.disabled, true)
 assert.match(ui.text(), /Faltan ejercicios/)
 ui.history(); assert.match(ui.text(), /Registro conservado/)
})
test('failed save retains current day, form and locked next day', async () => {
 const ui = harness({failure:{code:'network'}})
 ui.begin(); await ui.save()
 assert.match(ui.text(), /No se pudo guardar el día/)
 assert.ok(ui.nodes().some(n=>n.type==='form'))
 assert.match(JSON.stringify(ui.cards()[1]), /Bloqueado/)
})
test('save uses checked server registration and only persisted history unlocks next day', async () => {
 const ui = harness(); ui.begin(); await ui.save()
 assert.equal(ui.calls[0].name,'student_register_next_day_checked')
 assert.equal(ui.calls[0].args.p_expected_day,1)
 assert.equal(ui.calls[0].args.p_expected_last_id,null)
 assert.match(JSON.stringify(ui.cards()[1]), /Bloqueado/)
 const refreshed = harness({sessions:[record(1)]})
 assert.match(JSON.stringify(refreshed.cards()[1]), /Disponible/)
 assert.match(JSON.stringify(refreshed.cards()[2]), /Bloqueado/)
 refreshed.history(); assert.match(refreshed.text(), /Mi registro de entrenamientos/)
})
test('inactive member cannot begin a day even with exercises', () => {
 const ui = harness({status:'Inactivo'})
 assert.equal(ui.nodes(ui.cards()[0]).find(n=>n.type==='button').props.disabled,true)
})




test('RIR zero alone is retained with the correct exercise', async () => {
 const ui = harness(); ui.begin(); ui.field('RIR real', '0'); await ui.save()
 assert.equal(ui.calls[0].args.p_results.length, 1)
 assert.equal(ui.calls[0].args.p_results[0].exerciseId, 'exercise')
 assert.equal(ui.calls[0].args.p_results[0].rir, '0')
})
test('decimal kilos and RIR are saved without claiming performed sets or reps', async () => {
 const ui = harness(); ui.begin(); ui.field('Kilos utilizados', '22.5'); ui.field('RIR real', '2'); await ui.save()
 const result = ui.calls[0].args.p_results[0]
 assert.equal(result.load, '22.5'); assert.equal(result.rir, '2')
 assert.equal(result.sets, ''); assert.equal(result.reps, '')
 assert.equal(result.comment, undefined)
 assert.doesNotMatch(ui.text(), /Comentario del ejercicio|Series realizadas|Repeticiones realizadas/)
})
test('historical comments and performed sets remain readable', () => {
 const old = {...record(1),results:[{exerciseId:'exercise',name:'Sentadilla',sets:'3',reps:'10',load:'20 kg',rir:'2',comment:'Comentario anterior conservado'}]}
 const ui = harness({sessions:[old]}); ui.history()
 assert.match(ui.text(), /Comentario anterior conservado/)
})
test('successful save clears exercise inputs so the next day cannot inherit old loads', async () => {
 const ui = harness(); ui.begin(); ui.field('Kilos utilizados','25'); ui.field('RIR real','2'); await ui.save()
 const inputs=ui.nodes().filter(n=>n.type==='input' && n.props['aria-label']?.includes(' · Sentadilla'))
 assert.equal(inputs.length,2)
 assert.ok(inputs.every(n=>n.props.value===''))
})

test('completion action is available below current exercises before opening any load field', async () => {
 const ui=harness()
 const form=ui.nodes().find(n=>n.type==='form')
 const action=ui.nodes(form).find(n=>n.type==='button'&&JSON.stringify(n.props.children).includes('Completar entrenamiento'))
 assert.ok(action,'Visible completion action must be inside the current workout')
 assert.equal(action.props.disabled,false)
 assert.ok(ui.nodes(ui.cards()[1]).find(n=>n.type==='button').props.disabled)
 action.props.onClick()
 ui.render()
 await ui.save()
 assert.equal(ui.calls.length,1)
 assert.equal(ui.calls[0].name,'student_register_next_day_checked')
 assert.equal(ui.calls[0].args.p_expected_day,1)
})

