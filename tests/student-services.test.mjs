import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('student services isolate progress and restrict access decisions to verified admin',async()=>{
 const db=new PGlite();try {
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;grant usage on schema auth to authenticated,anon;alter default privileges in schema public grant all on tables to anon,authenticated;`)
 for(const f of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^00[1-9]_.*\.sql$/.test(n)).sort())await db.exec(readFileSync(new URL('../cloud/'+f,import.meta.url),'utf8').replace(/^\uFEFF/,''))
 await db.exec(readFileSync(new URL('../cloud/009_student_services.sql',import.meta.url),'utf8').replace(/^\uFEFF/,''))
 await db.exec(`insert into auth.users values('${id(1)}','a'),('${id(2)}','b'),('${id(3)}','c'),('${id(4)}','d');insert into user_roles values('${id(1)}','admin'),('${id(2)}','student'),('${id(3)}','student'),('${id(4)}','trainer');insert into members(id,user_id,trainer_user_id,first_name,last_name,joined_at,status) values('${id(11)}','${id(2)}','${id(4)}','A','Test',current_date,'Activo'),('${id(12)}','${id(3)}',null,'B','Test',current_date,'Activo');`)
 const as=async(n,aal='aal1',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id(n),aal]);await db.exec(`set role ${role}`)}
 await as(2)
 await db.exec(`insert into member_progress(member_id,metric,value,measured_on) values('${id(11)}','weight',68,current_date)`)
 await assert.rejects(db.exec(`insert into member_progress(member_id,metric,value,measured_on) values('${id(12)}','weight',68,current_date)`),/row-level/)
 await assert.rejects(db.exec(`insert into member_progress(member_id,metric,value,measured_on) values('${id(11)}','weight',0,current_date)`))
 const a=(await db.query('select request_nutrition_access() as id')).rows[0].id
 assert.equal((await db.query('select request_nutrition_access() as id')).rows[0].id,a)
 await assert.rejects(db.query("select decide_service_request($1,'enabled')",[a]),/segundo factor/)
 await assert.rejects(db.exec("update service_requests set status='enabled'"),/permission denied/)
 await assert.rejects(db.exec(`insert into service_requests(member_id,service,status) values('${id(11)}','nutrition','enabled')`),/permission denied/)
 await as(3);assert.equal((await db.query('select * from member_progress')).rows.length,0);assert.equal((await db.query('select * from service_requests')).rows.length,0)
 await db.exec('delete from member_progress');await as(4,'aal2');assert.equal((await db.query('select * from member_progress')).rows.length,0)
 await as(1);await assert.rejects(db.query("select decide_service_request($1,'enabled')",[a]),/segundo factor/)
 await as(1,'aal2');assert.equal((await db.query('select * from member_progress')).rows.length,1)
 await db.query("select decide_service_request($1,'enabled')",[a]);await as(2);assert.equal((await db.query('select status from service_requests')).rows[0].status,'enabled')
 await as(1,'aal2');await db.query("select decide_service_request($1,'revoked')",[a]);await as(2);assert.equal((await db.query('select status from service_requests')).rows[0].status,'revoked')
 await db.exec('delete from member_progress');assert.equal((await db.query('select * from member_progress')).rows.length,0)
 await as(1,'aal2');await db.exec(`insert into memberships(id,member_id,plan_name,months,starts_at,ends_at,price,service_extras) values('${id(20)}','${id(11)}','Trimestral + Kinesiología + Nutrición',3,current_date,current_date+90,100,array['Kinesiología','Nutrición'])`)
 await assert.rejects(db.exec("update memberships set service_extras=array['unknown']"))
 await as(2);await assert.rejects(db.exec('truncate member_progress'),/permission denied/)
 await as(2,'aal1','anon');await assert.rejects(db.query('select * from service_requests'),/permission denied/)
 }finally{await db.close()}
})
