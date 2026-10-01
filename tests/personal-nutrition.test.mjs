import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {PGlite} from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const api={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/nutritionCalculator.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api})
test('energy estimates use explicit adult inputs and never apply automatic calorie deficits',()=>{
 const a={...api.emptyAssessment(),age:'30',weight:'70',height:'175',sex:'male',activity:'1.55'}
 assert.equal(api.estimateEnergy(a).resting,1649);assert.equal(api.estimateEnergy(a).maintenance,2556)
 assert.equal(api.estimateEnergy({...a,sex:'female'}).resting,1483)
 for(const change of [{age:'17'},{weight:''},{height:'NaN'},{sex:''},{special:true},{age:'30.5'}])assert.equal(api.estimateEnergy({...a,...change}),null)
 assert.equal(api.estimateEnergy({...a,activity:''}).maintenance,null)
 assert.equal(api.estimateMacros({...a,kcal:'2000',protein:'100',fat:'60'}).carbs,265)
 assert.equal(api.estimateMacros({...a,kcal:'500',protein:'100',fat:'60'}),null)
})
test('private nutrition drafts, reviewed publication, cross-student isolation, MFA, backup and withdrawal',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;grant usage on schema auth to authenticated,anon;alter default privileges in schema public grant all on tables to anon,authenticated;`)
 for(const file of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort())await db.exec(readFileSync(new URL('../cloud/'+file,import.meta.url),'utf8').replace(/^\uFEFF/,''))
 await db.exec(readFileSync(new URL('../cloud/014_personal_nutrition.sql',import.meta.url),'utf8'))
 await db.exec(`insert into auth.users values('${id(1)}','a'),('${id(2)}','b'),('${id(3)}','c'),('${id(4)}','d');insert into user_roles values('${id(1)}','admin'),('${id(2)}','student'),('${id(3)}','student'),('${id(4)}','trainer');insert into members(id,user_id,first_name,last_name,joined_at,status) values('${id(11)}','${id(2)}','A','Test',current_date,'Activo'),('${id(12)}','${id(3)}','B','Test',current_date,'Activo');`)
 const as=async(n,aal='aal1',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id(n),aal]);await db.exec(`set role ${role}`)}
 const save=(expected,body='Dieta publicada')=>db.query('select save_nutrition_draft($1,$2,$3,$4,$5) as revision',[id(11),'Plan de prueba',body,{context:'Evaluación privada'},expected])
 for(const who of [1,2,3,4]){await as(who);await assert.rejects(save(0),/doble factor/);await assert.rejects(db.query('select enable_personal_nutrition($1)',[id(11)]))}
 await as(1,'aal2');assert.equal((await save(0)).rows[0].revision,1)
 await assert.rejects(save(0),/cambió/)
 await assert.rejects(db.query('select publish_nutrition_plan($1,1)',[id(11)]),/habilitá/)
 await db.query('select enable_personal_nutrition($1)',[id(11)])
 await db.query('select publish_nutrition_plan($1,1)',[id(11)])
 const first=(await db.query('select * from nutrition_plans')).rows[0]
 await db.query('select publish_nutrition_plan($1,1)',[id(11)])
 assert.equal((await db.query('select * from nutrition_plans')).rows[0].id,first.id)
 await save(1,'Borrador nuevo privado')
 await assert.rejects(db.query('select publish_nutrition_plan($1,1)',[id(11)]),/actual/)
 const backup=(await db.query('select export_application_backup() as value')).rows[0].value
 assert.equal(backup.schemaVersion,14);assert.equal(backup.tables.nutrition_drafts.length,1);assert.equal(backup.tables.nutrition_plans.length,1)
 await as(2);assert.equal((await db.query('select * from nutrition_drafts')).rows.length,0)
 assert.equal((await db.query('select * from nutrition_plans')).rows[0].body,'Dieta publicada')
 await assert.rejects(db.exec("update nutrition_plans set body='attack'"),/permission denied/)
 await assert.rejects(db.exec('truncate nutrition_plans'),/permission denied/)
 for(const who of [3,4,1]){await as(who,who===4?'aal2':'aal1');assert.equal((await db.query('select * from nutrition_plans')).rows.length,0)}
 await as(1,'aal2');await db.query('select withdraw_nutrition_plan($1)',[id(11)])
 await as(2);assert.equal((await db.query('select * from nutrition_plans')).rows.length,0)
 await as(1,'aal2');await db.query('select publish_nutrition_plan($1,2)',[id(11)])
 const request=(await db.query('select id from service_requests')).rows[0].id
 await db.query("select decide_service_request($1,'revoked')",[request]);await as(2);assert.equal((await db.query('select * from nutrition_plans')).rows.length,0)
 await as(2,'aal1','anon');await assert.rejects(db.exec('select * from nutrition_plans'),/permission denied/)
 await db.exec('reset role');assert.ok(!JSON.stringify((await db.query('select * from private.security_audit')).rows).includes('Evaluación privada'))
 await db.query('delete from members where id=$1',[id(11)]);assert.equal((await db.query('select * from nutrition_drafts')).rows.length,0)
 }finally{await db.close()}
})
