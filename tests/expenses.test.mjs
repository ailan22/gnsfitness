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
 const backup=(await db.query('select export_application_backup() data')).rows[0].data
 assert.equal(backup.schemaVersion,26);assert.equal(backup.tables.gym_expenses.length,1);assert.equal(backup.tables.gym_expense_history.length,2)
 await assert.rejects(db.exec('delete from gym_expenses'),/permission denied/)
 await as('student','aal2');assert.equal((await db.query('select count(*)::int n from gym_expenses')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from gym_expense_history')).rows[0].n,0)
 }finally{await db.close()}
})
