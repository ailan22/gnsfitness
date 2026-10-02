import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync,readdirSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'
const compile = name => ts.transpileModule(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText
const cryptoApi={};vm.runInNewContext(compile('backupCrypto.ts'),{exports:cryptoApi,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob})
const insertApi={};vm.runInNewContext(compile('confirmedInsert.ts'),{exports:insertApi})
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const pass='Una frase ficticia para pruebas 2026'

test('schema 15 encrypts shared-room appointments and rejects a copy without them',async()=>{
 const data={format:'gns-application-backup',version:1,schemaVersion:15,createdAt:new Date().toISOString(),tables:Object.fromEntries([...cryptoApi.backupTables,...cryptoApi.nutritionBackupTables,...cryptoApi.roomBackupTables].map(n=>[n,[]]))}
 data.tables.room_appointments=[{id:id(75),kind:'reiki',member_id:id(10)}]
 const file=await cryptoApi.encryptBackup(data,pass)
 assert.deepEqual(JSON.parse(JSON.stringify(await cryptoApi.decryptBackup(file,pass))),data)
 delete data.tables.room_appointments
 await assert.rejects(cryptoApi.encryptBackup(data,pass))
})

test('schema 14 encrypts nutrition drafts and published plans and rejects incomplete copies',async()=>{
 const data={format:'gns-application-backup',version:1,schemaVersion:14,createdAt:new Date().toISOString(),tables:Object.fromEntries([...cryptoApi.backupTables,...cryptoApi.nutritionBackupTables].map(n=>[n,[]]))}
 data.tables.nutrition_drafts=[{id:id(70),body:'Borrador privado'}]
 data.tables.nutrition_plans=[{id:id(71),body:'Plan publicado'}]
 const file=await cryptoApi.encryptBackup(data,pass)
 assert.ok(!file.includes('Borrador privado'))
 assert.deepEqual(JSON.parse(JSON.stringify(await cryptoApi.decryptBackup(file,pass))),data)
 delete data.tables.nutrition_drafts
 await assert.rejects(cryptoApi.encryptBackup(data,pass))
})
test('encrypted export roundtrip, random ciphertext, wrong password, tampering and partial files',async()=>{
 const data={format:'gns-application-backup',version:1,schemaVersion:13,createdAt:new Date().toISOString(),tables:Object.fromEntries(cryptoApi.backupTables.map(n=>[n,[]]))}
 data.tables.members=[{id:id(10),first_name:'Confidencial'}]
 const file=await cryptoApi.encryptBackup(data,pass)
 assert.ok(!file.includes('Confidencial'))
 assert.deepEqual(JSON.parse(JSON.stringify(await cryptoApi.decryptBackup(file,pass))),data)
 assert.notEqual(file,await cryptoApi.encryptBackup(data,pass))
 await assert.rejects(cryptoApi.decryptBackup(file,pass+'incorrecta'))
 const tampered=JSON.parse(file);tampered.ciphertext=(tampered.ciphertext[0]==='A'?'B':'A')+tampered.ciphertext.slice(1)
 await assert.rejects(cryptoApi.decryptBackup(JSON.stringify(tampered),pass))
 const partial=structuredClone(data);delete partial.tables.health_records
 await assert.rejects(cryptoApi.encryptBackup(partial,pass))
 const badKdf=JSON.parse(file);badKdf.iterations=1;await assert.rejects(cryptoApi.decryptBackup(JSON.stringify(badKdf),pass))
})
test('lost insert response is reconciled, retry cannot duplicate or discard changed draft',async()=>{
 let stored=null,inserts=0,offline=false
 const client={from(){return {select(){return this},eq(){return this},async maybeSingle(){if(offline)throw Error('offline');return {data:stored,error:null}},insert(row){inserts++;stored=structuredClone(row);return {select(){return {async single(){throw Error('lost response')}}}}}}}}
 const row={id:id(40),member_id:id(10),plan_name:'Prueba',price:3000,service_config:{physioDates:[],version:1}}
 await insertApi.confirmedInsert(client,'memberships',row)
 await insertApi.confirmedInsert(client,'memberships',row)
 assert.equal(inserts,1)
 await assert.rejects(insertApi.confirmedInsert(client,'memberships',{...row,price:5000}),/otros datos/)
 assert.equal(stored.price,3000)
 offline=true;await assert.rejects(insertApi.confirmedInsert(client,'memberships',{...row,id:id(41)}));assert.equal(inserts,1)
})
test('full schema: only MFA admin exports all app tables, dates validated, privacy audit preserved',async()=>{
 const db=new PGlite()
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
 grant usage on schema auth to anon,authenticated;alter default privileges in schema public grant all on tables to anon,authenticated;`)
 for(const name of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort()) await db.exec(readFileSync(new URL('../cloud/'+name,import.meta.url),'utf8').replace(/^\uFEFF/,''))
 for(const name of ['012_integrity_hardening.sql','013_encrypted_export.sql']) await db.exec(readFileSync(new URL('../cloud/'+name,import.meta.url),'utf8'))
 await db.exec(`insert into auth.users values('${id(1)}','admin@test'),('${id(2)}','student@test');insert into user_roles values('${id(1)}','admin'),('${id(2)}','student');
 insert into members(id,user_id,first_name,last_name,joined_at,status) values('${id(10)}','${id(2)}','Persona','Ficticia',current_date,'Activo');`)
 async function as(n,aal='aal1',role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[n?id(n):'',aal]);await db.exec(`set role ${role}`)}
 for(const [n,aal,role] of [[null,'aal1','anon'],[2,'aal2','authenticated'],[1,'aal1','authenticated']]){await as(n,aal,role);await assert.rejects(db.query('select export_application_backup()'))}
 await as(1,'aal2')
 const config={version:1,nutritionMonthly:3000,nutritionMonths:1,physioSessionPrice:650,physioDates:['2026-10-05']}
 const insert=c=>db.query(`insert into memberships(id,member_id,plan_name,months,starts_at,ends_at,price,service_extras,service_config) values($1,$2,'Plan',1,'2026-10-01','2026-10-31',5400,array['Nutrición','Kinesiología'],$3)`,[id(20),id(10),JSON.stringify(c)])
 for(const dates of [['2026-10-05','2026-10-05'],['2026-11-01'],['2026-02-30'],[{}]]) await assert.rejects(insert({...config,physioDates:dates}))
 await assert.rejects(insert({...config,nutritionMonths:12}));await assert.rejects(insert({...config,nutritionMonthly:-1}))
 await insert(config)
 await db.query("select request_privacy_action('access')")
 const snapshot=(await db.query('select export_application_backup() as backup')).rows[0].backup
 cryptoApi.validateBackup(snapshot);assert.equal(Object.keys(snapshot.tables).length,12);assert.equal(snapshot.tables.memberships.length,1);assert.equal(snapshot.tables.privacy_requests.length,1)
 const encrypted=await cryptoApi.encryptBackup(snapshot,pass)
 assert.deepEqual(JSON.parse(JSON.stringify(await cryptoApi.decryptBackup(encrypted,pass))),snapshot)
 await db.exec('reset role');assert.equal((await db.query("select count(*)::int as n from private.security_audit where entity_table='privacy_requests'")).rows[0].n,1)
 }finally{await db.close()}
})
