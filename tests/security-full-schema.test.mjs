import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'

test('all current migrations preserve database security boundaries', async () => {
 const db = new PGlite()
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
   grant usage on schema auth to anon,authenticated;
   alter default privileges in schema public grant all on tables to anon,authenticated;
   create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path='pg_catalog' as $$begin return; end;$$;`)
  for (const file of readdirSync(new URL('../cloud/',import.meta.url)).filter(n=>/^\d{3}_.*\.sql$/.test(n)).sort()) {
   await db.exec(readFileSync(new URL('../cloud/'+file,import.meta.url),'utf8').replace(/^\uFEFF/,''))
  }
  const tables = (await db.query(`select c.relname, c.relrowsecurity,
    has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') anonymous_access,
    has_table_privilege('authenticated',c.oid,'TRUNCATE,TRIGGER,REFERENCES') unsafe_access
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')`)).rows
  assert.ok(tables.length >= 19)
  for(const table of tables) {
   assert.equal(table.relrowsecurity,true,table.relname+' needs RLS')
   assert.equal(table.anonymous_access,false,table.relname+' allows anonymous access')
   assert.equal(table.unsafe_access,false,table.relname+' allows operations outside RLS')
  }
  const functions = (await db.query(`select n.nspname,p.proname,p.proconfig,
    has_function_privilege('anon',p.oid,'EXECUTE') anonymous_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prosecdef`)).rows
  for(const fn of functions) {
   assert.ok(fn.proconfig?.some(v=>v==='search_path=""' || (fn.proname==='rls_auto_enable' && v==='search_path=pg_catalog')),fn.proname+' needs fixed safe search_path')
   assert.equal(fn.anonymous_execute,false,fn.proname+' permits anonymous execution')
  }
 } finally { await db.close() }
})
