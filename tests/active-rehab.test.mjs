import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/activeRehab.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports })
const row = (id, episode_id, status, date = '2026-09-30', correction_of = null) => ({ id, member_id:'member', kind:'physio_followup', occurred_on:date, created_at:date, episode_id, correction_of, payload:{status} })
const active = exports.activeRehabByMember
test('only treatment and reassessment remain active; assessments alone are excluded', () => {
  for (const status of ['Alta', 'Pausa', 'Derivación']) assert.equal(active([row('a','episode',status)]).size,0)
  for (const status of ['En tratamiento', 'Reevaluación']) assert.equal(active([row('a','episode',status)]).size,1)
  assert.equal(active([{...row('a',null,''),kind:'physio_assessment'}]).size,0)
})
test('a later discharge closes only its own episode', () => {
  const entries = [row('a','one','En tratamiento','2026-09-28'), row('b','one','Alta'),row('c','two','En tratamiento','2026-09-29')]
  assert.equal(active(entries).get('member').id,'c')
  assert.equal(active(entries.slice(0,2)).size,0)
})
test('corrections replace prior status and assessment aliases share an episode', () => {
  const assessment = {...row('original',null,''),kind:'physio_assessment'}
  const corrected = {...assessment,id:'corrected',correction_of:'original'}
  assert.equal(active([assessment,corrected,row('a','original','En tratamiento','2026-09-28'),row('b','corrected','Alta')]).size,0)
  assert.equal(active([row('a','one','Alta'),row('b','one','En tratamiento','2026-09-30','a')]).size,1)
})
