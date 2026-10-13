-- Platform-created RLS helper: event triggers do not need API client execution.
-- Keep the event trigger and its automatic RLS protection intact.
begin;
set local lock_timeout = '5s';
do $$
begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='rls_auto_enable'
   and p.pronargs=0 and p.prorettype='event_trigger'::regtype) then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end;
$$;
commit;
