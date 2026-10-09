import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('PostgreSQL: permissions, payment integrity and stale training requests', async t => {
 const db = new PGlite()
 try {
  await db.exec("set timezone = 'America/Montevideo'")
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key, email text);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated, anon;
  `)
  for (const f of ['001_initial.sql','002_student.sql','003_welcome.sql','004_payment_integrity.sql','005_training_precondition.sql']) await db.exec(readFileSync(new URL('../cloud/'+f,import.meta.url),'utf8').replace(/^\uFEFF/,''))
  // Migrations are safe to reapply without replacing the initial schema.
  for (const f of ['ACTIVAR_PROTECCIONES.sql']) await db.exec(readFileSync(new URL('../cloud/'+f,import.meta.url),'utf8').replace(/^\uFEFF/,''))
  await db.exec(`insert into auth.users values ('${uid(1)}','admin@test'),('${uid(2)}','a@test'),('${uid(3)}','b@test');
   insert into public.user_roles values ('${uid(1)}','admin'),('${uid(2)}','student'),('${uid(3)}','student');
   insert into public.members(id,user_id,first_name,last_name,joined_at,status) values
   ('${uid(12)}','${uid(2)}','A','Alumno',current_date,'Activo'),('${uid(13)}','${uid(3)}','B','Alumno',current_date,'Activo');
   insert into public.member_admin_notes values('${uid(12)}','Solo administrador');
   insert into public.memberships(id,member_id,plan_name,months,starts_at,ends_at,price) values
   ('${uid(22)}','${uid(12)}','Mensual',1,current_date,current_date+30,100),('${uid(23)}','${uid(13)}','Mensual',1,current_date,current_date+30,100);
   insert into public.routines(id,member_id,name,level,days_per_week,program_rounds,block_rounds) values
   ('${uid(32)}','${uid(12)}','Rutina A','Inicial',3,4,2),('${uid(33)}','${uid(13)}','Rutina B','Inicial',3,4,2);
  `)
  async function asUser(n, role='authenticated') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n ? uid(n) : '']); await db.exec(`set role ${role}`) }
  const pay = (request, cents=6000, member=12,plan=22) => db.query('select public.register_payment($1,$2,$3,current_date,$4,\'Efectivo\')',[uid(request),uid(member),uid(plan),cents])
  await t.test('student sees own data only and cannot edit roles, payments or private notes', async()=>{
   await asUser(2)
   assert.equal((await db.query('select * from members')).rows.length,1)
   assert.equal((await db.query('select * from routines')).rows.length,1)
   assert.equal((await db.query('select * from memberships')).rows.length,1)
   assert.equal((await db.query('select * from member_admin_notes')).rows.length,0)
   assert.equal((await db.query('select * from user_roles')).rows[0].role,'student')
   await assert.rejects(pay(42),/administrador/)
   await assert.rejects(db.exec(`insert into user_roles values('${uid(5)}','admin')`))
   await assert.rejects(db.exec(`insert into payments values('${uid(43)}','${uid(12)}','${uid(22)}',current_date,1,'Efectivo')`))
  })
  await t.test('anonymous users cannot access member records or payment RPC', async()=>{
   await asUser(null,'anon'); await assert.rejects(db.exec('select * from members')); await assert.rejects(pay(42))
  })
  await t.test('same payment request retried creates only one record', async()=>{
   await asUser(1); await pay(42); await pay(42)
   assert.equal((await db.query('select count(*)::int as n from payments')).rows[0].n,1)
   await assert.rejects(pay(42,5000),/otros datos/)
  })
  await t.test('second stale payment cannot exceed remaining balance, including direct API insert',async()=>{
   await assert.rejects(pay(44,6000),/saldo/)
   await assert.rejects(db.exec(`insert into payments values('${uid(44)}','${uid(12)}','${uid(22)}',current_date,60,'Efectivo')`),/saldo/)
   await assert.rejects(db.exec(`update memberships set price=50 where id='${uid(22)}'`),/cobrado/)
   await pay(45,4000)
   assert.equal(Number((await db.query('select sum(amount) as total from payments')).rows[0].total),100)
  })
  const train = (request,last=null,day=1,week=1,routine=32) => db.query("select public.student_register_next_day_checked($1,$2,current_date,'','[]'::jsonb,$3,$4,$5)",[uid(request),uid(routine),last?uid(last):null,day,week])
  await t.test('first student completion succeeds and retry is idempotent',async()=>{
   await asUser(2); await train(52); await train(52)
   assert.equal((await db.query('select count(*)::int as n from sessions')).rows[0].n,1)
  })
  await t.test('stale second device is rejected; refreshed expected day succeeds',async()=>{
   await assert.rejects(train(53),/cambió/)
   await train(53,52,2)
   assert.equal((await db.query('select count(*)::int as n from sessions')).rows[0].n,2)
  })
  await t.test('incorrect expected day rolls back the entire inserted session',async()=>{
   await assert.rejects(train(54,53,1),/esperado/)
   assert.equal((await db.query('select count(*)::int as n from sessions')).rows[0].n,2)
  })
  await t.test('student cannot use another routine or bypass checks via legacy/private function',async()=>{
   await assert.rejects(train(55,null,1,1,33),/asignada/)
   await assert.rejects(db.query("select public.student_register_next_day($1,$2,current_date,'','[]')",[uid(56),uid(32)]),/Actualizá/)
   await assert.rejects(db.query("select private.student_register_next_day_impl($1,$2,current_date,'','[]')",[uid(56),uid(32)]),/permission/)
   await asUser(3)
   assert.equal((await db.query('select * from sessions')).rows.length,0)
  })

  await t.test('inactive students cannot register another training day',async()=>{
   await asUser(1); await db.exec(`update members set status='Pausado' where id='${uid(12)}'`)
   await asUser(2); await assert.rejects(train(57,53,3),/activa/)
   await asUser(1); await db.exec(`update members set status='Activo' where id='${uid(12)}'`)
  })
  await t.test('one thousand additional members and individual routines preserve access isolation',async()=>{
   await db.exec('reset role')
   await db.exec(`insert into members(id,first_name,last_name,joined_at,status)
    select md5('member-test-'||g)::uuid, 'Prueba', g::text, current_date,'Activo' from generate_series(1,1000) g;
    insert into routines(id,member_id,name,level,days_per_week,program_rounds,block_rounds,plan)
    select md5('routine-test-'||g)::uuid,md5('member-test-'||g)::uuid,'Rutina '||g,'Inicial',3,4,2,
    jsonb_build_object('exercisesByDay',jsonb_build_object('1',jsonb_build_array(jsonb_build_object('id',g,'name','Ejercicio '||g)))) from generate_series(1,1000) g;`)
   await asUser(1)
   assert.equal((await db.query('select count(*)::int as n from members')).rows[0].n,1002)
   assert.equal((await db.query('select count(*)::int as n from routines')).rows[0].n,1002)
   await asUser(2)
   assert.equal((await db.query('select count(*)::int as n from members')).rows[0].n,1)
   assert.equal((await db.query('select count(*)::int as n from routines')).rows[0].n,1)
  })
 } finally { await db.close() }
})
