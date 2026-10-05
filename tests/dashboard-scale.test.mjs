import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'

test('dashboard handles 2000 members and 120000 sessions without exporting histories; MFA and RLS remain enforced',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;grant usage on schema auth to authenticated,anon;alter default privileges in schema public grant all on tables to anon,authenticated;`)
 for(const file of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort())await db.exec(readFileSync(new URL('../cloud/'+file,import.meta.url),'utf8').replace(/^\uFEFF/,''))
 await db.exec(readFileSync(new URL('../cloud/020_dashboard_scale.sql',import.meta.url),'utf8'))
 // Fixture generation is owner-only and isolated. No real data or remote calls.
 await db.exec(`insert into auth.users values(md5('admin')::uuid,'admin@test'),(md5('student')::uuid,'student@test');insert into user_roles values(md5('admin')::uuid,'admin'),(md5('student')::uuid,'student');
 insert into members(id,user_id,first_name,last_name,joined_at,status) select md5('member'||n)::uuid,case when n=1 then md5('student')::uuid end,'Persona','Ejemplo '||n,current_date,'Activo' from generate_series(1,2000)n;
 insert into routines(id,member_id,name,level,days_per_week,program_rounds,block_rounds) select md5('routine'||n)::uuid,md5('member'||n)::uuid,'Plan ficticio','Inicial',3,52,4 from generate_series(1,2000)n;
 insert into memberships(id,member_id,plan_name,months,starts_at,ends_at,price) select md5('plan'||n)::uuid,md5('member'||n)::uuid,'3 días',1,current_date,current_date+5,2100 from generate_series(1,2000)n;
 insert into payments(id,member_id,membership_id,paid_at,amount,method) select md5('pay'||n)::uuid,md5('member'||n)::uuid,md5('plan'||n)::uuid,current_date,100,'Efectivo' from generate_series(1,2000)n;
 alter table sessions disable trigger user;
 insert into sessions(id,member_id,routine_id,performed_at,routine_name,day,block,week) select md5('session'||n)::uuid,md5('member'||(1+(n-1)%2000))::uuid,md5('routine'||(1+(n-1)%2000))::uuid,current_date,'Plan ficticio',1,1,1 from generate_series(1,120000)n;
 alter table sessions enable trigger user; analyze;`)
 const as=async(who,aal='aal1',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',md5($1)::uuid::text,false),set_config('request.jwt.claim.aal',$2,false)",[who,aal]);await db.exec(`set role ${role}`)}
 await as('admin');await assert.rejects(db.query('select admin_dashboard(0)'),/doble factor/)
 await as('student','aal2');await assert.rejects(db.query('select admin_dashboard(0)'),/doble factor/)
 assert.equal((await db.query('select count(*)::integer n from members')).rows[0].n,1)
 assert.equal((await db.query('select count(*)::integer n from routines')).rows[0].n,1)
 assert.equal((await db.query('select count(*)::integer n from sessions')).rows[0].n,60)
 await as('none','aal1','anon');await assert.rejects(db.query('select admin_dashboard(0)'),/permission denied/)
 await as('admin','aal2');const start=performance.now();const first=(await db.query('select admin_dashboard(0) data')).rows[0].data;const ms=performance.now()-start
 assert.equal(first.members,2000);assert.equal(first.active,2000);assert.equal(first.routines,2000);assert.equal(first.sessions,120000)
 assert.equal(first.monthlyIncome,200000);assert.equal(first.income,200000);assert.equal(first.pending,4000000);assert.equal(first.debtors,2000)
 assert.equal(first.expiring,2000);assert.equal(first.pendingMembers.length,25);assert.equal(first.plans[0].count,2000)
 const second=(await db.query('select admin_dashboard(1) data')).rows[0].data
 assert.equal(second.pendingMembers.length,25);assert.ok(second.pendingMembers.every(p=>!first.pendingMembers.some(q=>q.id===p.id)))
 assert.equal((await db.query('select admin_dashboard(80) data')).rows[0].data.pendingMembers.length,0)
 for(const n of [-1,null,100001])await assert.rejects(db.query('select admin_dashboard($1)',[n]),/Página/)
 const bytes=Buffer.byteLength(JSON.stringify(first));assert.ok(bytes<12000)
 writeFileSync(new URL('../output/dashboard-scale-result.json',import.meta.url),JSON.stringify({engine:'PGlite isolated PostgreSQL',members:2000,routines:2000,sessions:120000,firstQueryMs:Math.round(ms),responseBytes:bytes,permissions:'admin MFA only; student isolation verified',productionLoadTest:false},null,2))
 }finally{await db.close()}
})
