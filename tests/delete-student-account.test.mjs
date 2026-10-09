import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
test('account deletion requires MFA admin, protects staff and preserves member records', async () => {
  const db = new PGlite()
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.aal',true))$$;
      grant usage on schema auth to anon,authenticated;`)
    for (const f of ['001_initial.sql','007_security.sql','023_delete_student_account.sql']) await db.exec(readFileSync(new URL('../cloud/'+f,import.meta.url),'utf8'))
    await db.exec(`insert into auth.users values('${id(1)}','admin@test'),('${id(2)}','student@test'),('${id(3)}','staff@test');
      insert into user_roles values('${id(1)}','admin'),('${id(2)}','student'),('${id(3)}','trainer');
      insert into members(id,user_id,first_name,last_name,joined_at,status) values('${id(12)}','${id(2)}','Alumno','Prueba',current_date,'Activo'),('${id(13)}','${id(3)}','Staff','Prueba',current_date,'Activo');
      insert into memberships(id,member_id,plan_name,months,starts_at,ends_at,price) values('${id(22)}','${id(12)}','Mensual',1,current_date,current_date+30,1750);`)
    async function user(n, aal='aal2', role='authenticated') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.aal',$2,false)",[id(n),aal]); await db.exec(`set role ${role}`) }
    const remove = (member=12,target=2) => db.query('select delete_student_account($1,$2) as deleted',[id(member),id(target)])
    await user(2); await assert.rejects(remove(),/administrador/)
    await user(1,'aal1'); await assert.rejects(remove(),/administrador/)
    await user(1); await assert.rejects(remove(13,3),/alumnos/)
    await assert.rejects(remove(12,3),/cambió/)
    assert.equal((await remove()).rows[0].deleted,true)
    assert.equal((await remove()).rows[0].deleted,false)
    const member=(await db.query('select user_id,status from members where id=$1',[id(12)])).rows[0]
    assert.deepEqual(member,{user_id:null,status:'Baja'})
    assert.equal((await db.query('select count(*)::int as n from memberships')).rows[0].n,1)
    await user(2); assert.equal((await db.query('select * from members')).rows.length,0)
    await db.exec('reset role'); assert.equal((await db.query('select * from auth.users where id=$1',[id(2)])).rows.length,0)
    await user(1,'aal2','anon'); await assert.rejects(remove(),/permission/)
  } finally { await db.close() }
})
