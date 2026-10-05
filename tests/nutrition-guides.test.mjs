import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('guide assignment is explicit, scoped per student, MFA protected, revocable and backed up',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;grant usage on schema auth to authenticated,anon;alter default privileges in schema public grant all on tables to anon,authenticated;`)
 for(const file of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort())await db.exec(readFileSync(new URL('../cloud/'+file,import.meta.url),'utf8').replace(/^\uFEFF/,''))
 await db.exec(`insert into auth.users values('${id(1)}','a'),('${id(2)}','b'),('${id(3)}','c');insert into user_roles values('${id(1)}','admin'),('${id(2)}','student'),('${id(3)}','student');insert into members(id,user_id,first_name,last_name,joined_at,status) values('${id(11)}','${id(2)}','A','Test',current_date,'Activo'),('${id(12)}','${id(3)}','B','Test',current_date,'Activo');`)
 const as=async(n,aal='aal1')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id(n),aal]);await db.exec('set role authenticated')}
 const assign=(who,g,e=[])=>db.query('select assign_nutrition_guides($1,$2,$3)',[id(who),g,e])
 await as(1,'aal2');await assert.rejects(assign(11,['food']),/solicitar/)
 await as(2);await db.query('select request_nutrition_access()')
 await as(3);await db.query('select request_nutrition_access()')
 for(const n of [1,2,3]){await as(n);await assert.rejects(assign(11,['food']),/doble factor/)}
 await as(1,'aal2');await assert.rejects(assign(11,['unknown']),/inválida/)
 await assign(11,['food']);await assign(12,['recipes'])
 await as(2);let rows=(await db.query('select * from service_requests')).rows;assert.equal(rows.length,1);assert.deepEqual(rows[0].nutrition_guides,['food'])
 await assert.rejects(db.exec("update service_requests set nutrition_guides=array['recipes']"),/permission denied/)
 await as(3);assert.deepEqual((await db.query('select * from service_requests')).rows[0].nutrition_guides,['recipes'])
 await as(1,'aal2');await assert.rejects(assign(11,['recipes']),/cambió/)
 await assign(11,['recipes'],['food']);await assign(11,[],['recipes'])
 assert.deepEqual((await db.query('select nutrition_guides from service_requests where member_id=$1',[id(11)])).rows[0].nutrition_guides,[])
 await assign(11,['food']);const req=(await db.query('select id from service_requests where member_id=$1',[id(11)])).rows[0].id
 await db.query("select decide_service_request($1,'revoked')",[req]);await db.query("select decide_service_request($1,'enabled')",[req])
 assert.deepEqual((await db.query('select nutrition_guides from service_requests where id=$1',[req])).rows[0].nutrition_guides,[])
 const backup=(await db.query('select export_application_backup() as value')).rows[0].value
 assert.deepEqual(backup.tables.service_requests.find(x=>x.member_id===id(12)).nutrition_guides,['recipes'])
 }finally{await db.close()}
})
