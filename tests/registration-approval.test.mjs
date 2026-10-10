import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('registration requires verified email and administrator MFA; approval links only a matching active member',async()=>{
 const db=new PGlite()
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
  grant usage on schema auth to authenticated,anon;
  alter default privileges in schema public grant all on tables to authenticated,anon;`)
  for(const file of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort()) await db.exec(readFileSync(new URL('../cloud/'+file,import.meta.url),'utf8').replace(/^\uFEFF/,''))
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
   ('${id(1)}','admin@example.test',now()),('${id(2)}','a@example.test',now()),('${id(3)}','b@example.test',null),
   ('${id(4)}','existing@example.test',now()),('${id(5)}','rejected@example.test',now()),('${id(6)}','changed@example.test',now());
   insert into user_roles values('${id(1)}','admin');
   insert into members(id,first_name,last_name,email,joined_at,status) values('${id(40)}','Existing','Member','existing@example.test',current_date,'Activo');`)
  const as=async(n,aal='aal1',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[n?id(n):'',aal]);await db.exec(`set role ${role}`)}
  const submit=()=>db.query("select submit_registration('Nombre','Apellido','+59899123456') state")
  await as(null,'aal1','anon');await assert.rejects(submit(),/permission denied/)
  await as(3);await assert.rejects(submit(),/Confirmá tu correo/)
  await as(2);assert.equal((await submit()).rows[0].state,'pending');assert.equal((await submit()).rows[0].state,'pending')
  assert.equal((await db.query('select * from members')).rows.length,0)
  assert.equal((await db.query('select * from user_roles')).rows.length,0)
  await assert.rejects(db.exec("update registration_requests set status='approved'"),/permission denied/)
  await assert.rejects(db.exec(`insert into user_roles values('${id(2)}','admin')`),/permission denied/)
  await assert.rejects(db.query('select decide_registration($1,true)',[id(2)]),/administrador/)
  await as(4);await submit();assert.equal((await db.query('select * from registration_requests')).rows.length,1)
  await as(5);await submit()
  await as(6);await submit()
  await as(1);await assert.rejects(db.query('select decide_registration($1,true)',[id(2)]),/doble factor/)
  await as(1,'aal2');assert.equal((await db.query('select * from registration_requests')).rows.length,4)
  const approved=(await db.query('select decide_registration($1,true) member',[id(2)])).rows[0].member
  assert.ok(approved)
  await assert.rejects(db.query('select decide_registration($1,true)',[id(2)]),/ya fue resuelta/)
  assert.equal((await db.query('select decide_registration($1,true) member',[id(4)])).rows[0].member,id(40))
  await db.query('select decide_registration($1,false)',[id(5)])
  await db.exec('reset role');await db.exec(`update auth.users set email='different@example.test' where id='${id(6)}'`)
  await as(1,'aal2');await assert.rejects(db.query('select decide_registration($1,true)',[id(6)]),/correo cambió/)
  await as(5);assert.equal((await submit()).rows[0].state,'rejected');assert.equal((await db.query('select * from members')).rows.length,0)
  await as(2);const members=(await db.query('select * from members')).rows;assert.equal(members.length,1);assert.equal(members[0].id,approved)
  assert.equal((await db.query('select role from user_roles')).rows[0].role,'student')
 }finally{await db.close()}
})
