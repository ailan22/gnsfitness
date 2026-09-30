import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
test('security migration blocks privilege bypass and enforces staff MFA in PostgreSQL', async t => {
 const db = new PGlite()
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true)) $$;
   grant usage on schema auth to authenticated,anon;`)
  for (const name of ['001_initial.sql','002_student.sql','003_welcome.sql','004_payment_integrity.sql','005_training_precondition.sql','006_student_access.sql']) await db.exec(readFileSync(new URL('../cloud/'+name,import.meta.url),'utf8').replace(/^\uFEFF/,''))
  // Reproduce permissive platform defaults before applying the fix.
  await db.exec('grant all on all tables in schema public to authenticated; grant truncate on public.members to public;')
  for (let n=0;n<2;n++) await db.exec(readFileSync(new URL('../cloud/007_security.sql',import.meta.url),'utf8'))
  await db.exec(`insert into auth.users values('${id(1)}','admin@test'),('${id(2)}','a@test'),('${id(3)}','b@test'),('${id(4)}','trainer@test');
   insert into user_roles values('${id(1)}','admin'),('${id(2)}','student'),('${id(3)}','student'),('${id(4)}','trainer');
   insert into members(id,user_id,trainer_user_id,first_name,last_name,joined_at,status,email) values
    ('${id(12)}','${id(2)}','${id(4)}','A','Alumno',current_date,'Activo','a@test'),
    ('${id(13)}','${id(3)}',null,'B','Alumno',current_date,'Activo','b@test');
   insert into member_admin_notes values('${id(12)}','Información privada');
   insert into routines(id,member_id,name,level,days_per_week,program_rounds,block_rounds) values
    ('${id(32)}','${id(12)}','A','Inicial',3,4,2),('${id(33)}','${id(13)}','B','Inicial',3,4,2);`)
  async function as(n,aal='aal1',role='authenticated') {
   await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[n?id(n):'',aal]);await db.exec(`set role ${role}`)
  }
  await t.test('password-only admin cannot read records, edit or invoke privileged RPCs',async()=>{
   await as(1);assert.equal((await db.query('select * from members')).rows.length,0)
   assert.equal((await db.query('update members set first_name=\'ATTACK\' returning id')).rows.length,0)
   await assert.rejects(db.query('select prepare_student_access($1)',[id(12)]),/administrador/)
   await assert.rejects(db.query("select register_payment($1,$2,$3,current_date,100,'Efectivo')",[id(41),id(12),id(22)]),/administrador/)
   assert.equal((await db.query('select role from user_roles')).rows[0].role,'admin')
  })
  await t.test('MFA admin works but cannot truncate, change roles or tamper with history',async()=>{
   await as(1,'aal2');assert.equal((await db.query('select * from members')).rows.length,2)
   await db.query('update members set first_name=$1 where id=$2',['Updated',id(12)])
   for(const sql of ['truncate members cascade','truncate user_roles cascade','update user_roles set role=\'admin\'','delete from private.security_audit']) await assert.rejects(db.exec(sql),/permission denied/)
  })
  await t.test('student cannot gain privileges even with MFA, and sees only own routine',async()=>{
   await as(2,'aal2');assert.equal((await db.query('select id from members')).rows[0].id,id(12))
   assert.equal((await db.query('select * from members')).rows.length,1)
   assert.equal((await db.query('select * from routines')).rows.length,1)
   assert.equal((await db.query('select * from member_admin_notes')).rows.length,0)
   assert.equal((await db.query('update members set user_id=$1 returning id',[id(2)])).rows.length,0)
   await assert.rejects(db.exec('truncate members cascade'),/permission denied/)
   await assert.rejects(db.query('select finish_student_access($1,$2,$3)',[id(13),id(2),'b@test']),/administrador/)
  })
  await t.test('trainer requires MFA and only reads assigned students',async()=>{
   await as(4);assert.equal((await db.query('select * from members')).rows.length,0)
   await as(4,'aal2');assert.equal((await db.query('select id from members')).rows[0].id,id(12))
   assert.equal((await db.query('select * from members')).rows.length,1)
   assert.equal((await db.query('select * from member_admin_notes')).rows.length,0)
  })
  await t.test('anonymous role has no data access',async()=>{
   await as(null,'aal1','anon');await assert.rejects(db.exec('select * from members'),/permission denied/)
   await assert.rejects(db.exec('truncate members cascade'),/permission denied/)
  })
  await t.test('audit records actor and action without storing personal record copies',async()=>{
   await db.exec('reset role')
   const rows=(await db.query("select * from private.security_audit where operation='UPDATE'")).rows
   assert.equal(rows.length,1);assert.equal(rows[0].actor_id,id(1));assert.equal(rows[0].entity_id,id(12))
   assert.ok(!JSON.stringify(rows).includes('Updated'))
  })
 } finally { await db.close() }
})
