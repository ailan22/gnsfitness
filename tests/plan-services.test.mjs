import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'
const compile = name => ts.transpileModule(fs.readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText
const membership={}, services={}
vm.runInNewContext(compile('membership.ts'),{exports:membership})
vm.runInNewContext(compile('planServices.ts'),{exports:services,require:()=>membership})
const {planTotal,serviceDates,summarizeServiceDates,scheduledForDay}=services

test('plan costs include nutrition for each month and unique physio sessions',()=>{
 for (const [base,months] of [[1750,1],[6300,3],[15600,6],[31200,12]]) {
  assert.equal(planTotal(base,months,false,[]),base)
  assert.equal(planTotal(base,months,true,[]),base+3000*months)
  assert.equal(planTotal(base,months,true,['2026-10-05','2026-10-05','2026-10-07']),base+3000*months+1300)
 }
})
test('week selection, leap year and plan bounds generate exact dates',()=>{
 assert.deepEqual([...serviceDates('2026-10',[1,3],'2026-10-01','2026-10-31',[1])],['2026-10-05','2026-10-07'])
 assert.deepEqual([...serviceDates('2028-02',[2],'2028-02-20','2028-02-29')],['2028-02-22','2028-02-29'])
 assert.equal(serviceDates('2026-13',[1],'2026-01-01','2026-12-31').length,0)
 assert.deepEqual([...serviceDates('2026-10',[4],'2026-10-08','2026-10-15')],['2026-10-08','2026-10-15'])
})
test('reminder only on selected date; old plans remain compatible',()=>{
 assert.equal(scheduledForDay(null,'2026-10-01'),false)
 const config={version:1,physioDates:['2026-10-05']}
 assert.equal(scheduledForDay(config,'2026-10-05'),true)
 assert.equal(scheduledForDay(config,'2026-10-06'),false)
 assert.equal(summarizeServiceDates(['2026-10-07','2026-10-05','2026-10-06']),'10/2026: 5–7')
})
test('schedule migration is repeatable and preserves historical prices',async()=>{
 const db=new PGlite();try {
 await db.exec('create table memberships (id int primary key, price numeric); insert into memberships values(1,1750);')
 const sql=fs.readFileSync(new URL('../cloud/011_plan_service_schedule.sql',import.meta.url),'utf8')
 await db.exec(sql);await db.exec(sql)
 assert.equal(Number((await db.query('select price from memberships where id=1')).rows[0].price),1750)
 const config={version:1,nutritionMonthly:3000,nutritionMonths:3,physioSessionPrice:650,physioDates:['2026-10-05']}
 await db.query('update memberships set service_config=$1 where id=1',[JSON.stringify(config)])
 assert.deepEqual((await db.query('select service_config from memberships')).rows[0].service_config,config)
 await assert.rejects(db.exec(`update memberships set service_config='[]'::jsonb`))
 }finally {await db.close()}
})
