-- Read-only inspection: no member data or credentials in results.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anonymous_select,
  has_table_privilege('authenticated', c.oid, 'TRUNCATE') as client_truncate,
  has_table_privilege('authenticated', c.oid, 'TRIGGER') as client_trigger
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in
 ('user_roles','members','member_admin_notes','routines','memberships','payments','sessions','session_reviews');

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','private') order by tablename, policyname;

select n.nspname as schema_name, p.proname, p.prosecdef as security_definer,
 p.proconfig as function_settings, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prokind='f'
 and (p.prosecdef or p.proname in ('is_admin','is_assigned_trainer'));

select to_regclass('private.security_audit') is not null as audit_table_exists;
