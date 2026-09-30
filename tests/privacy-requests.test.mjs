import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('privacy requests isolate accounts and require verified administrator to resolve', async () => {
 const db = new PGlite()
 try {
  await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;grant usage on schema auth to authenticated,anon;alter default privileges in schema public grant all on tables to anon,authenticated;`)
  for (const name of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort()) await db.exec(readFileSync(new URL('../cloud/'+name,import.meta.url),'utf8').replace(/^\uFEFF/,''))
  await db.exec(readFileSync(new URL('../cloud/010_privacy_requests.sql',import.meta.url),'utf8'))
  await db.exec(`insert into auth.users values('${id(1)}','a'),('${id(2)}','b'),('${id(3)}','c'),('${id(4)}','d');insert into user_roles values('${id(1)}','admin'),('${id(2)}','student'),('${id(3)}','student'),('${id(4)}','trainer');`)
  const as = async(n,aal='aal1',role='authenticated') => {await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id(n),aal]);await db.exec(`set role ${role}`)}
  await as(2)
  const request = (await db.query("select request_privacy_action('deletion') as id")).rows[0].id
  assert.equal((await db.query("select request_privacy_action('deletion') as id")).rows[0].id,request)
  await assert.rejects(db.query("select request_privacy_action('other')"))
  await assert.rejects(db.query("select request_privacy_action(null)"))
  await assert.rejects(db.exec("update privacy_requests set status='completed'"), /permission denied/)
  await assert.rejects(db.query("select complete_privacy_request($1,'No autorizado')",[request]),/segundo factor/)
  await as(3); assert.equal((await db.query('select * from privacy_requests')).rows.length,0)
  await as(4,'aal2'); assert.equal((await db.query('select * from privacy_requests')).rows.length,0)
  await as(1); assert.equal((await db.query('select * from privacy_requests')).rows.length,0)
  await assert.rejects(db.query("select complete_privacy_request($1,'No autorizado')",[request]),/segundo factor/)
  await as(1,'aal2'); assert.equal((await db.query('select * from privacy_requests')).rows.length,1)
  await assert.rejects(db.query("select complete_privacy_request($1,'')",[request]))
  await db.query("select complete_privacy_request($1,'Respuesta enviada y actuaciones registradas')",[request])
  await as(2); assert.equal((await db.query('select status from privacy_requests')).rows[0].status,'completed')
  assert.notEqual((await db.query("select request_privacy_action('deletion') as id")).rows[0].id,request)
  await assert.rejects(db.exec('truncate privacy_requests'),/permission denied/)
  await as(2,'aal1','anon'); await assert.rejects(db.query("select request_privacy_action('deletion')"),/permission denied/)
  await assert.rejects(db.query('select * from privacy_requests'),/permission denied/)
 } finally { await db.close() }
})
