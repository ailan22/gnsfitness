import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import vm from 'node:vm'
import ts from 'typescript'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const api={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/roomSchedule.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api})

test('all 35-minute bookings fit completely inside opening hours',()=>{
 const times=api.availableRoomTimes('2030-10-01',[])
 for(const time of ['08:00','11:25','16:00','19:25']) assert.ok(times.includes(time))
 for(const time of ['07:55','11:30','12:00','15:55','19:30','20:00']) assert.ok(!times.includes(time))
 assert.equal(times.length,84)
})
test('available times exclude the whole 35-minute interval and allow adjacent appointments',()=>{
 const row={id:id(20),session_date:'2030-10-01',starts_at:'2030-10-01T20:00:00Z',ends_at:'2030-10-01T20:35:00Z',cancelled:false,membership_id:id(10)}
 const times=api.availableRoomTimes('2030-10-01',[row]);assert.ok(!times.includes('16:30'));assert.ok(!times.includes('17:00'));assert.ok(!times.includes('17:30'));assert.ok(times.includes('16:25'));assert.ok(times.includes('17:35'))
 assert.ok(api.availableRoomTimes('2030-10-01',[row],id(10)).includes('17:00'))
})
test('database enforces room overlap, permissions, atomic plan updates, retry and encrypted-export scope',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
  grant usage on schema auth to anon,authenticated;alter default privileges in schema public grant all on tables to anon,authenticated;`)
  for(const file of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^0\d\d_.*\.sql$/.test(n)).sort())await db.exec(readFileSync(new URL('../cloud/'+file,import.meta.url),'utf8').replace(/^\uFEFF/,''))
  await db.exec(readFileSync(new URL('../cloud/015_shared_room.sql',import.meta.url),'utf8'))
  await db.exec(`insert into auth.users values('${id(1)}','admin@test'),('${id(2)}','student@test');insert into user_roles values('${id(1)}','admin'),('${id(2)}','student');insert into members(id,user_id,first_name,last_name,joined_at,status) values('${id(10)}','${id(2)}','Persona','Prueba',current_date,'Activo');`)
  async function as(n,aal='aal2',role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[n?id(n):'',aal]);await db.exec(`set role ${role}`)}
  const book=(request,time,kind='reiki',date='2030-10-01')=>db.query('select book_holistic_session($1,$2,$3,$4,$5)',[id(request),id(10),kind,date,time])
  for(const [user,aal,role] of [[1,'aal1','authenticated'],[2,'aal2','authenticated'],[null,'aal1','anon']]){await as(user,aal,role);await assert.rejects(book(30,'17:00'))}
  await as(1)
  for(const time of ['07:55','11:30','12:00','15:55','19:30','20:00']) await assert.rejects(book(70,time),/sesión completa/)
  for(const [n,time] of [[71,'08:00'],[72,'11:25'],[73,'16:00'],[74,'19:25']]) {
   await book(n,time,'reiki','2030-11-01'); await db.query('select cancel_holistic_session($1)',[id(n)])
  }
  await db.exec('reset role');await db.exec("delete from room_appointments where session_date='2030-11-01'");await as(1)
  const config={version:1,nutritionMonthly:3000,nutritionMonths:0,physioSessionPrice:650,physioDates:['2030-10-01'],physioTimes:{'2030-10-01':'17:00'}}
  await db.query(`insert into memberships(id,member_id,plan_name,months,starts_at,ends_at,price,service_extras,service_config) values($1,$2,'Plan',1,'2030-10-01','2030-10-31',2400,array['Kinesiología'],$3)`,[id(20),id(10),JSON.stringify(config)])
  for(const time of ['16:30','17:00','17:30'])await assert.rejects(book(30,time),/room_no_overlap/)
  await book(30,'17:35');await book(30,'17:35');assert.equal((await db.query('select * from room_appointments')).rows.length,2)
  await assert.rejects(book(31,'17:40','akashic'),/room_no_overlap/)
  await assert.rejects(db.query('update memberships set price=3050,service_config=$1 where id=$2',[JSON.stringify({...config,physioTimes:{'2030-10-01':'17:40'}}),id(20)]),/room_no_overlap/)
  assert.equal(Number((await db.query('select price from memberships where id=$1',[id(20)])).rows[0].price),2400)
  await db.query('select cancel_holistic_session($1)',[id(30)]);await book(31,'17:35','akashic')
  await db.query('update memberships set service_config=$1 where id=$2',[JSON.stringify({...config,physioDates:['2030-10-01','2030-10-02']}),id(20)])
  await assert.rejects(book(32,'10:00','reiki','2030-10-02'),/sin hora/)
  const backup=(await db.query('select export_application_backup() as data')).rows[0].data;assert.equal(backup.schemaVersion,15);assert.equal(backup.tables.room_appointments.length,3)
  await as(2);assert.equal((await db.query('select * from room_appointments')).rows.length,0);await assert.rejects(db.query('update room_appointments set cancelled=true'))
 }finally{await db.close()}
})
