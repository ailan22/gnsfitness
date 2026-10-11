import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
test('expenses require admin MFA, reject stale edits, retry safely and export history',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;grant usage on schema auth to authenticated,anon;alter default privileges in schema public grant all on tables to anon,authenticated;`)
 for(const f of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort())await db.exec(readFileSync(new URL('../cloud/'+f,import.meta.url),'utf8').replace(/^\uFEFF/,''))
 await db.exec(`insert into auth.users values(md5('admin')::uuid,'admin@test'),(md5('student')::uuid,'student@test');insert into user_roles values(md5('admin')::uuid,'admin'),(md5('student')::uuid,'student');`)
 const as=async(who,aal)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',md5($1)::uuid::text,false),set_config('request.jwt.claim.aal',$2,false)",[who,aal]);await db.exec('set role authenticated')}
 const row={category:'Luz',concept:'Factura de luz',expense_type:'fixed',amount_cents:450050,due_date:'2026-10-20',status:'pending',paid_date:null,notes:''}
 const save=(version,data=row)=>db.query("select save_gym_expense(md5('expense')::uuid,$1,$2::jsonb) v",[version,JSON.stringify(data)])
 await as('admin','aal1');await assert.rejects(save(0),/doble factor/)
 await as('student','aal2');await assert.rejects(save(0),/doble factor/)
 await as('admin','aal2');assert.equal((await save(0)).rows[0].v,1);assert.equal((await save(0)).rows[0].v,1)
 await assert.rejects(save(0,{...row,amount_cents:10}),/cambió/)
 await assert.rejects(save(1,{...row,amount_cents:-1}),/check constraint/)
 assert.equal((await save(1,{...row,status:'paid',paid_date:'2026-01-01'})).rows[0].v,2)
 assert.equal((await db.query('select count(*)::int n from gym_expense_history')).rows[0].n,2)
 const settings=await db.query('select * from gym_business_settings');assert.equal(settings.rows[0].employee_count,1)
 const configure=(v,r,n)=>db.query('select save_gym_business_settings($1,$2,$3) v',[v,r,n])
 await assert.rejects(configure(1,'IVA mínimo',-1),/check constraint/)
 assert.equal((await configure(1,'Régimen general',2)).rows[0].v,2)
 assert.equal((await configure(1,'Régimen general',2)).rows[0].v,2)
 await assert.rejects(configure(1,'IVA mínimo',1),/cambió/)
 const detail={period:'2026-10',reference:'PRUEBA',lines:[{label:'Jubilatorio del titular',amount_cents:500000},{label:'Créditos / bonificaciones',amount_cents:-49950}]}
 const bps={...row,category:'BPS',bps_breakdown:detail}
 await assert.rejects(save(2,{...bps,amount_cents:1}),/no coincide/)
 await assert.rejects(save(2,{...bps,bps_breakdown:{...detail,lines:[...detail.lines,detail.lines[0]]}}),/duplicado/)
 await assert.rejects(save(2,{...bps,bps_breakdown:{...detail,lines:[{label:'Otro',amount_cents:-10}]}}),/inválido/)
 await assert.rejects(save(2,{...bps,bps_breakdown:{...detail,period:'2026-13'}}),/inválido/)
 assert.equal((await save(2,bps)).rows[0].v,3)
 assert.equal((await save(2,bps)).rows[0].v,3)
 assert.equal((await save(3,{...bps,status:'paid',paid_date:'2026-01-01'})).rows[0].v,4)
 const backup=(await db.query('select export_application_backup() data')).rows[0].data
 assert.equal(backup.schemaVersion,27);assert.equal(backup.tables.gym_business_settings[0].employee_count,2);assert.equal(backup.tables.gym_expenses.length,1);assert.equal(backup.tables.gym_expense_history.length,4);assert.deepEqual(backup.tables.gym_expenses[0].bps_breakdown,detail)
 await assert.rejects(db.exec('delete from gym_expenses'),/permission denied/)
 await as('admin','aal1');await assert.rejects(configure(2,'IVA mínimo',1),/doble factor/);await as('student','aal2');await assert.rejects(configure(2,'IVA mínimo',1),/doble factor/);assert.equal((await db.query('select count(*)::int n from gym_business_settings')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from gym_expenses')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from gym_expense_history')).rows[0].n,0)
 }finally{await db.close()}
})
