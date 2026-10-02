import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import {readFileSync} from 'node:fs'
const compile = file=>ts.transpileModule(readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText
const membership={};vm.runInNewContext(compile('membership.ts'),{exports:membership})
function harness() {
 const plan={id:'p',starts_at:'2026-10-01',ends_at:'2026-10-31',price:2750,service_config:{version:1,nutritionMonthly:3000,nutritionMonths:0,physioSessionPrice:650,physioDates:['2026-10-05']}}
 const row=structuredClone(plan), states=[], refs=[];let cursor=0,ref=0,tree,saved=0
 const exports={};vm.runInNewContext(compile('AdditionalPhysioSessions.tsx'),{exports,require(name){
  if(name==='react')return{useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>states[i]=v]},useRef(v){return refs[ref++]??={current:v}}}
  if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}
  if(name==='./PlanSessionSchedule')return{__esModule:true,default:'schedule'}
  if(name==='./planServices')return{PHYSIO_SESSION_PRICE:650,summarizeServiceDates:v=>v.join(',')}
  if(name==='./membership')return membership
  throw Error(name)
 }})
 const client={from(){const filters=[];let patch;return{update(p){patch=p;return this},eq(k,v){if(k!=='member_id')filters.push([k,v]);return this},select(){return this},async maybeSingle(){if(!filters.every(([k,v])=>k==='service_config'?JSON.stringify(row[k])===v:row[k]===v))return{data:null,error:null};Object.assign(row,patch);return{data:{id:row.id},error:null}}}}}
 function render(){cursor=0;ref=0;tree=exports.default({client,plan,memberId:'m',onSaved(){saved++}})}
 function nodes(n=tree){if(!n||typeof n!=='object')return[];if(Array.isArray(n))return n.flatMap(nodes);return[n,...nodes(n.props?.children ?? null)]}
 render();return{row,plan,get saved(){return saved},select(dates){nodes().find(n=>n.type==='schedule').props.onChange(dates);nodes().find(n=>n.type==='schedule').props.onTimesChange(Object.fromEntries(dates.map(d=>[d,'17:00'])));render()},async save(){await nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));render()},text(){return JSON.stringify(tree)}}
}
test('adding sessions preserves existing dates, charges only new distinct dates and does not double charge a stale retry',async()=>{
 const ui=harness();ui.select(['2026-10-05','2026-10-15','2026-10-15']);await ui.save()
 assert.equal(ui.row.price,3400);assert.equal(ui.row.service_config.physioDates.join(','),'2026-10-05,2026-10-15');assert.equal(ui.saved,1)
 ui.select(['2026-10-15']);await ui.save();assert.equal(ui.row.price,3400);assert.equal(ui.saved,1);assert.match(ui.text(),/No se confirmó/)
})
test('a concurrently edited plan or invalid date is never overwritten',async()=>{
 const ui=harness();ui.select(['2026-11-01']);await ui.save();assert.equal(ui.row.price,2750)
 ui.select(['2026-10-16']);ui.row.price=4000;await ui.save();assert.equal(ui.row.price,4000);assert.equal(ui.row.service_config.physioDates.length,1);assert.equal(ui.saved,0)
})
