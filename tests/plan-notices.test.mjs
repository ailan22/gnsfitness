import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
function module(file, dependencies = {}) {
 const exports = {}
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText, {exports,require:name=>dependencies[name]})
 return exports
}
const membership = module('membership.ts')
const {planReminders,uruguayToday} = module('planReminders.ts', {'./membership':membership})
const plan = {id:'p',member_id:'m',starts_at:'2026-01-01',ends_at:'2026-12-31',service_config:{version:1,physioDates:['2026-12-27','2026-12-28','2026-12-29']}}
test('sessions start two days before, stay through the date, and disappear afterwards',()=>{
 assert.equal(planReminders([plan],'2026-12-25').filter(n=>n.kind==='physio').length,1)
 assert.equal(planReminders([plan],'2026-12-26').filter(n=>n.kind==='physio').length,2)
 assert.equal(planReminders([plan],'2026-12-29').filter(n=>n.kind==='physio').length,1)
 assert.equal(planReminders([plan],'2026-12-30').filter(n=>n.kind==='physio').length,0)
})
test('annual plan expiry appears ten days before and changes reminder stage at five days',()=>{
 assert.equal(planReminders([plan],'2026-01-26').length,0)
 assert.equal(planReminders([plan],'2026-12-20').filter(n=>n.kind==='expiry').length,0)
 const early=planReminders([plan],'2026-12-21').find(n=>n.kind==='expiry')
 assert.equal(early.days,10)
 assert.notEqual(early.key,planReminders([plan],'2026-12-26').find(n=>n.kind==='expiry').key)
 assert.equal(planReminders([plan],'2026-12-26').filter(n=>n.kind==='expiry').length,1)
 assert.equal(planReminders([plan],'2026-12-31')[0].days,0)
 assert.equal(planReminders([plan],'2027-01-01').length,0)
})
test('early renewal suppresses notice, gaps do not; overlapping longer coverage wins',()=>{
 const renewal={...plan,id:'renewal',starts_at:'2027-01-01',ends_at:'2027-01-31',service_config:null}
 assert.equal(planReminders([plan,renewal],'2026-12-26').filter(n=>n.kind==='expiry').length,0)
 assert.equal(planReminders([plan,{...renewal,starts_at:'2027-01-02'}],'2026-12-26').filter(n=>n.kind==='expiry').length,1)
 assert.equal(planReminders([plan,{...renewal,starts_at:'2026-12-01'}],'2026-12-26').filter(n=>n.kind==='expiry').length,0)
})
test('dates use Uruguay timezone and invalid/out-of-plan session dates are ignored',()=>{
 assert.equal(uruguayToday(new Date('2026-10-02T01:00:00Z')),'2026-10-01')
 assert.equal(planReminders([{...plan,service_config:{version:1,physioDates:['2027-01-01','invalid']}}],'2026-12-31').filter(n=>n.kind==='physio').length,0)
})
