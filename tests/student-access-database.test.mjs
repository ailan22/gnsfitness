import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('student access SQL enforces identity, roles and unique linking',async t=>{
 const db=new PGlite()
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;`)
 for(const f of ['001_initial.sql','006_student_access.sql','006_student_access.sql'])await db.exec(fs.readFileSync(new URL('../cloud/'+f,import.meta.url),'utf8').replace(/^\uFEFF/,''))
 await db.exec(`insert into auth.users values('${id(1)}','admin@example.test'),('${id(2)}','student@example.test'),('${id(3)}','new@example.test');
 insert into user_roles values('${id(1)}','admin'),('${id(2)}','student');
 insert into members(id,first_name,last_name,joined_at,status,email) values('${id(10)}','Socio','Prueba',current_date,'Activo','new@example.test');`)
 async function as(n){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);await db.exec('set role authenticated')}
 const prepare=()=>db.query('select prepare_student_access($1) as result',[id(10)])
 const finish=(uid=3,email='new@example.test')=>db.query('select finish_student_access($1,$2,$3)',[id(10),id(uid),email])
 await t.test('student cannot invite or assign roles',async()=>{await as(2);await assert.rejects(prepare(),/administrador/);await assert.rejects(finish(),/administrador/)})
 await t.test('administrator prepares account and repeated requests are throttled',async()=>{await as(1);assert.equal((await prepare()).rows[0].result.email,'new@example.test');await assert.rejects(prepare(),/minuto/)})
 await t.test('mismatched identity is rejected and does not grant a role',async()=>{await assert.rejects(finish(2),/coincide/);assert.equal((await db.query('select user_id from members')).rows[0].user_id,null)})
 await t.test('matching account is linked and receives only student role, retry is safe',async()=>{await finish();await finish();assert.equal((await db.query('select user_id from members')).rows[0].user_id,id(3));await as(3);assert.equal((await db.query('select role from user_roles')).rows[0].role,'student')})
 await t.test('existing staff role cannot be replaced',async()=>{await as(1);await db.exec(`update members set user_id=null,email='admin@example.test' where id='${id(10)}'`);await assert.rejects(finish(1,'admin@example.test'),/rol/);await assert.rejects(prepare(),/personal/)})
 await t.test('duplicate email and inactive member are rejected',async()=>{await db.exec(`update members set email='new@example.test' where id='${id(10)}'; insert into members(id,first_name,last_name,joined_at,status,email) values('${id(11)}','Otro','Socio',current_date,'Activo','NEW@example.test')`);await assert.rejects(finish(),/otra ficha/);await assert.rejects(prepare(),/repetido/);await db.exec(`update members set status='Pausado' where id='${id(10)}'`);await assert.rejects(finish(),/disponible/)})
 } finally{await db.close()}
})
