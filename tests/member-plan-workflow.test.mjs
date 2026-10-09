import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import ts from 'typescript'
import vm from 'node:vm'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/membership.ts', import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{exports})
test('renewal starts today after a lapse, or after the last contracted period without losing paid days',()=>{
  assert.equal(exports.renewalStart(['2026-09-30'],'2026-10-08'),'2026-10-08')
  assert.equal(exports.renewalStart(['2026-10-31','2026-12-31'],'2026-10-08'),'2027-01-01')
  assert.equal(exports.renewalStart(['2026-10-08'],'2026-10-08'),'2026-10-09')
  assert.equal(exports.membershipEnd('2024-01-31',1),'2024-02-29')
  assert.equal(exports.membershipEnd('2026-10-08',3),'2027-01-07')
  assert.equal(exports.renewalStart(['invalid'],'2026-10-08'),null)
})
test('renewal preserves debts, rejects stale or overlapping periods and isolates payments with MFA',async()=>{
 const db=new PGlite()
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 try {
  await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;grant usage on schema auth to authenticated,anon;alter default privileges in schema public grant all on tables to anon,authenticated;`)
  for(const name of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort())await db.exec(readFileSync(new URL('../cloud/'+name,import.meta.url),'utf8').replace(/^\uFEFF/,''))
  await db.exec(readFileSync(new URL('../cloud/021_member_plan_workflow.sql',import.meta.url),'utf8'))
  await db.exec(`insert into auth.users values('${id(1)}','admin@test'),('${id(2)}','student@test');insert into user_roles values('${id(1)}','admin'),('${id(2)}','student');insert into members(id,user_id,first_name,last_name,joined_at,status) values('${id(10)}','${id(2)}','Uno','Prueba',current_date,'Activo'),('${id(11)}',null,'Dos','Prueba',current_date,'Activo');`)
  const as=async(n,aal='aal2',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id(n),aal]);await db.exec(`set role ${role}`)}
  const plan={id:id(20),member_id:id(10),plan_name:'Mensual · 3 días por semana',months:1,starts_at:'2026-01-01',ends_at:'2026-01-31',price:2100,service_extras:[],service_details:'',service_config:null}
  const create=(row,expected)=>db.query('select create_membership_period($1::jsonb,$2::uuid)',[JSON.stringify(row),expected])
  await as(1,'aal1');await assert.rejects(create(plan,null),/doble factor/)
  await as(2);await assert.rejects(create(plan,null),/doble factor/)
  await as(1);await create(plan,null);await create(plan,null)
  await assert.rejects(create({...plan,price:2600},null),/otros datos/)
  await assert.rejects(create({...plan,id:id(21)},id(20)),/superpone/)
  const renewed={...plan,id:id(22),starts_at:'2026-02-01',ends_at:'2026-02-28'}
  await create(renewed,id(20))
  await assert.rejects(create({...renewed,id:id(23),starts_at:'2026-03-01',ends_at:'2026-03-31'},id(20)),/cambió/)
  const payment=()=>db.query('select register_membership_payment($1,$2,$3,$4,$5,$6)',[id(30),id(10),id(20),'2026-01-15',100000,'Efectivo'])
  await payment();await payment()
  const snapshot=(await db.query('select admin_dashboard(0) data')).rows[0].data
  assert.equal(snapshot.pending,3200);assert.equal(snapshot.debtors,1);assert.equal(snapshot.pendingMembers.length,1)
  assert.equal(snapshot.pendingMembers[0].balance,3200)
  assert.equal((await db.query('select count(*)::int n from payments')).rows[0].n,1)
  await assert.rejects(db.query('select register_membership_payment($1,$2,$3,$4,$5,$6)',[id(31),id(11),id(20),'2026-01-15',100,'Efectivo']),/pertenece/)
  await assert.rejects(db.query('select register_membership_payment($1,$2,$3,$4,$5,$6)',[id(32),id(10),id(20),'2026-01-15',110001,'Efectivo']),/supera/)
  await as(2);await assert.rejects(payment(),/administrador/)
  await as(1,'aal2','anon');await assert.rejects(create(plan,null),/permission denied/)
 } finally {await db.close()}
})
