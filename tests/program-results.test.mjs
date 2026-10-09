import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('program evaluation enforces MFA, ownership, revisions, privacy and backup inclusion',async()=>{
 const db=new PGlite();try{
 await db.exec("set timezone = 'America/Montevideo'")
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;grant usage on schema auth to authenticated,anon;alter default privileges in schema public grant all on tables to anon,authenticated;`)
 for(const file of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort())await db.exec(readFileSync(new URL('../cloud/'+file,import.meta.url),'utf8').replace(/^\uFEFF/,''))
 await db.exec(`insert into auth.users values('${id(1)}','admin'),('${id(2)}','one'),('${id(3)}','two');insert into user_roles values('${id(1)}','admin'),('${id(2)}','student'),('${id(3)}','student');insert into members(id,user_id,first_name,last_name,joined_at,status) values('${id(11)}','${id(2)}','A','Test',current_date,'Activo'),('${id(12)}','${id(3)}','B','Test',current_date,'Activo');insert into routines(id,member_id,name,goal,level,days_per_week,program_rounds,block_rounds,plan) values('${id(21)}','${id(11)}','Programa A','Fuerza','Inicial',2,24,4,'{}'),('${id(22)}','${id(12)}','Programa B','Fuerza','Inicial',2,24,4,'{}');`)
 const as=async(n,aal='aal1',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id(n),aal]);await db.exec(`set role ${role}`)}
 const save=(expected=0,routine=id(21))=>db.query("select save_program_result($1,$2,current_date,$3,$4,$5,$6) as revision",[id(11),routine,'Mejor control observado','Prueba comparable','Continuar',expected])
 for(const n of [1,2,3]){await as(n);await assert.rejects(save(),/doble factor/)}
 await as(1,'aal2');await assert.rejects(save(0,id(22)),/no pertenece/)
 assert.equal((await save()).rows[0].revision,1);await assert.rejects(save(),/cambió/)
 assert.equal((await save(1)).rows[0].revision,2)
 const backup=(await db.query('select export_application_backup() as payload')).rows[0].payload
 assert.equal(backup.schemaVersion,18);assert.equal(backup.tables.program_results.length,1)
 await as(2);assert.equal((await db.query('select * from program_results')).rows.length,1)
 await assert.rejects(db.exec("update program_results set observations='alterado'"),/permission denied/)
 await assert.rejects(db.exec('truncate program_results'),/permission denied/)
 await as(3);assert.equal((await db.query('select * from program_results')).rows.length,0)
 await as(1);assert.equal((await db.query('select * from program_results')).rows.length,0)
 await as(2,'aal1','anon');await assert.rejects(db.exec('select * from program_results'),/permission denied/)
 await db.exec('reset role');assert.ok(!JSON.stringify((await db.query('select * from private.security_audit')).rows).includes('Mejor control observado'))
 }finally{await db.close()}
})
