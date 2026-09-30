import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import ts from 'typescript'
import vm from 'node:vm'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/healthRecords.ts', import.meta.url),'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2023 } }).outputText, {exports, Date})
const { healthFields, validateHealth, validHealthDate } = exports
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const payload = kind => Object.fromEntries(healthFields[kind].filter(field => field.required).map(field => [field.key, field.options?.[0] ?? 'Dato de prueba']))

test('clinical validation distinguishes unknown values from pain zero and rejects incomplete referrals', () => {
  assert.equal(validHealthDate('2026-02-30'), false)
  assert.equal(validHealthDate('2024-02-29'), true)
  const intake = payload('training_intake')
  assert.equal(validateHealth('training_intake', intake), null)
  assert.ok(validateHealth('training_intake', {...intake,symptoms:'Síntomas referidos'}))
  const physio = payload('physio_assessment')
  assert.equal(validateHealth('physio_assessment',{...physio,pain_rest:'0'}),null)
  assert.equal(validateHealth('physio_assessment',{...physio,pain_rest:''}),null)
  assert.ok(validateHealth('physio_assessment',{...physio,pain_rest:'11'}))
  assert.ok(validateHealth('physio_assessment',{...physio,alerts:'Requiere derivación'}))
})
test('lost-response reconciliation accepts matching content only, never discards later edits', () => {
  const row={member_id:id(11),kind:'training_intake',occurred_on:'2026-01-01',professional:'A',payload:{goals:'A',activity:'B'}}
  assert.equal(exports.sameHealthContent({...row,registration:'',episode_id:null,payload:{activity:'B',goals:'A'}},row),true)
  assert.equal(exports.sameHealthContent({...row,payload:{goals:'Older',activity:'B'}},row),false)
  assert.equal(exports.sameHealthContent({...row,member_id:id(12)},row),false)
})
test('health records enforce private append-only history and valid clinical relationships in PostgreSQL', async t => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true)) $$;
      grant usage on schema auth to authenticated,anon;
      alter default privileges in schema public grant all on tables to anon,authenticated;`)
    for (const name of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^00[1-8]_.*\.sql$/.test(n)).sort()) await db.exec(readFileSync(new URL('../cloud/'+name, import.meta.url),'utf8').replace(/^\uFEFF/,''))
    await db.exec(readFileSync(new URL('../cloud/008_health_records.sql',import.meta.url),'utf8'))
    await db.exec(`insert into auth.users values('${id(1)}','admin@test'),('${id(2)}','student@test'),('${id(3)}','trainer@test');
      insert into user_roles values('${id(1)}','admin'),('${id(2)}','student'),('${id(3)}','trainer');
      insert into members(id,user_id,trainer_user_id,first_name,last_name,joined_at,status) values('${id(11)}','${id(2)}','${id(3)}','A','Prueba',current_date,'Activo'),('${id(12)}',null,null,'B','Prueba',current_date,'Activo');`)
    async function as(n,aal='aal2',role='authenticated') {
      await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[n?id(n):'',aal]); await db.exec(`set role ${role}`)
    }
    async function insert(n,kind='training_intake',data=payload(kind),extra={}) {
      const row={id:id(n),member_id:id(11),kind,occurred_on:'2026-01-01',professional:'Profesional de prueba',payload:data,...extra}
      const cols=Object.keys(row); return db.query(`insert into health_records(${cols.join(',')}) values(${cols.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(row))
    }
    await t.test('verified administrator saves each form with server author and timestamp',async()=>{
      await as(1)
      const row=(await insert(21,'training_intake',payload('training_intake'),{created_by:id(2),created_at:'2000-01-01'})).rows[0]
      assert.equal(row.created_by,id(1)); assert.ok(!String(row.created_at).startsWith('2000'))
      await insert(22,'physio_assessment')
      await insert(23,'physio_followup',payload('physio_followup'),{episode_id:id(22)})
    })
    await t.test('students, assigned trainers and password-only admin cannot see or insert clinical data',async()=>{
      for (const [n,aal] of [[2,'aal2'],[3,'aal2'],[1,'aal1']]) {
        await as(n,aal); assert.equal((await db.query('select * from health_records')).rows.length,0)
        await assert.rejects(insert(30+n),/row-level security/)
      }
      await as(null,'aal1','anon'); await assert.rejects(db.query('select * from health_records'),/permission denied/)
    })
    await t.test('saved records cannot be overwritten, deleted or truncated',async()=>{
      await as(1)
      for (const sql of ["update health_records set professional='Changed'",'delete from health_records','truncate health_records cascade']) await assert.rejects(db.exec(sql),/permission denied/)
      await insert(24,'training_intake',payload('training_intake'),{correction_of:id(21),correction_reason:'Corrección informada'})
      await assert.rejects(insert(25,'training_intake',payload('training_intake'),{correction_of:id(21),correction_reason:'Otra'}),/unique constraint/)
    })
    await t.test('invalid linkage, missing fields, arbitrary JSON and fake enums are rejected server-side',async()=>{
      await assert.rejects(insert(40,'physio_followup',payload('physio_followup')),/Evaluación inicial/)
      await assert.rejects(insert(40,'physio_followup',payload('physio_followup'),{episode_id:id(22),member_id:id(12)}),/Evaluación inicial/)
      await assert.rejects(insert(40,'physio_followup',payload('physio_followup'),{episode_id:id(22),occurred_on:'2025-12-31'}),/Evaluación inicial/)
      await assert.rejects(insert(40,'training_intake',payload('training_intake'),{correction_of:id(22),correction_reason:'Wrong kind'}),/Rectificación inválida/)
      await assert.rejects(insert(40,'training_intake',{}),/obligatorio/)
      await assert.rejects(insert(40,'training_intake',{...payload('training_intake'),secret:'no'}),/Campo inválido/)
      await assert.rejects(insert(40,'training_intake',{...payload('training_intake'),goals:['nested']}),/Campo inválido/)
      await assert.rejects(insert(40,'physio_assessment',{...payload('physio_assessment'),pain_rest:'11'}),/Dolor/)
      await assert.rejects(insert(40,'physio_assessment',{...payload('physio_assessment'),review_date:'2026-02-30'}),/date|range/)
      await assert.rejects(insert(40,'training_intake',{...payload('training_intake'),consent:'Sí'}),/Consentimiento/)
      await assert.rejects(insert(40,'training_intake',{...payload('training_intake'),symptoms:'Síntomas referidos'}),/síntomas/)
      await assert.rejects(insert(40,'physio_assessment',{...payload('physio_assessment'),alerts:'Requiere derivación'}),/derivación/)
      await assert.rejects(insert(40,'training_intake',payload('training_intake'),{occurred_on:'2099-01-01'}),/Fecha/)
    })
    await t.test('audit identifies actor and record without clinical contents',async()=>{
      await db.exec('reset role');const rows=(await db.query("select * from private.security_audit where entity_table='health_records'")).rows
      assert.equal(rows.length,4);assert.ok(rows.every(row=>row.actor_id===id(1)));assert.ok(!JSON.stringify(rows).includes('Dato de prueba'))
    })
  } finally { await db.close() }
})
