import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('staff training uses server preconditions, MFA, ownership and idempotency',async t=>{
 const db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
 grant usage on schema auth to anon,authenticated;`)
 for(const name of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort())await db.exec(readFileSync(new URL('../cloud/'+name,import.meta.url),'utf8').replace(/^\uFEFF/,''))
 await db.exec(readFileSync(new URL('../cloud/017_staff_training.sql',import.meta.url),'utf8'))
 await db.exec(readFileSync(new URL('../cloud/FINALIZAR_REGISTRO_SEGURO.sql',import.meta.url),'utf8'))
 await db.exec(`insert into auth.users values('${id(1)}','admin@test'),('${id(2)}','student@test'),('${id(3)}','trainer@test');
 insert into user_roles values('${id(1)}','admin'),('${id(2)}','student'),('${id(3)}','trainer');
 insert into members(id,user_id,trainer_user_id,first_name,last_name,joined_at,status) values
 ('${id(10)}','${id(2)}','${id(3)}','Prueba','A',current_date,'Activo'),('${id(11)}',null,null,'Prueba','B',current_date,'Activo');
 insert into routines(id,member_id,name,level,days_per_week,program_rounds,block_rounds) values
 ('${id(20)}','${id(10)}','Plan A','Inicial',2,4,2),('${id(21)}','${id(11)}','Plan B','Inicial',2,4,2);`)
 const date=(await db.query("select (now() at time zone 'America/Montevideo')::date::text d")).rows[0].d
 const row={id:id(30),member_id:id(10),performed_at:date,routine_id:id(20),routine_name:'Plan A',day:1,block:1,week:1,notes:'',results:[]}
 async function as(n,aal='aal2',role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[n?id(n):'',aal]);await db.exec(`set role ${role}`)}
 const save=(value=row,last=null,suggested=true)=>db.query('select staff_register_session_checked($1,$2,$3) id',[JSON.stringify(value),suggested,last])
 await t.test('anonymous, password-only admin and student cannot invoke staff write',async()=>{
  for(const [n,aal,role] of [[null,'aal1','anon'],[1,'aal1','authenticated'],[2,'aal2','authenticated']]){await as(n,aal,role);await assert.rejects(save())}
 })
 await t.test('admin cannot bypass RPC using direct INSERT; RPC succeeds once',async()=>{
  await as(1);await assert.rejects(db.query('insert into sessions(id,member_id,performed_at) values($1,$2,$3)',[id(99),id(10),date]),/permission denied/)
  assert.equal((await save()).rows[0].id,id(30));await save()
  assert.equal((await db.query('select count(*)::int n from sessions')).rows[0].n,1)
  await assert.rejects(save({...row,notes:'Changed'}),/otros datos/)
 })
 await t.test('stale device cannot insert next day; matching refreshed request can',async()=>{
  await assert.rejects(save({...row,id:id(31)}),/cambió/)
  await assert.rejects(save({...row,id:id(31),day:2,week:2},id(30)),/cambió/)
  await save({...row,id:id(31),day:2},id(30))
  await as(2)
  await assert.rejects(db.query("select student_register_next_day_checked($1,$2,$3,'','[]',$4,2,1)",[id(32),id(20),date,id(30)]),/cambió/)
  await db.query("select student_register_next_day_checked($1,$2,$3,'','[]',$4,1,2)",[id(32),id(20),date,id(31)])
 })
 await t.test('trainer cannot cross member boundary or attach another routine',async()=>{
  await as(3)
  await assert.rejects(save({...row,id:id(35),member_id:id(11)},null,false),/doble factor/)
  await assert.rejects(save({...row,id:id(35),routine_id:id(21),routine_name:'Plan B'},null,false),/no asignada/)
 })
 await t.test('manual history stays available, malformed results rejected and audit preserved',async()=>{
  await as(1)
  await assert.rejects(save({...row,id:id(35),results:[{name:'X',load:100}]},null,false),/inválido/)
  await assert.rejects(save({...row,id:id(35),day:9},null,false),/inválidos/)
  await save({...row,id:id(35),routine_id:null,routine_name:'',day:null,block:null,week:null},null,false)
  await db.exec('reset role')
  assert.equal((await db.query("select count(*)::int n from private.security_audit where entity_table='sessions' and operation='INSERT'")).rows[0].n,4)
 })
 }finally{await db.close()}
})
