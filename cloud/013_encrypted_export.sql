begin;
-- One stable statement snapshot; no REST row-limit truncation. App records only,
-- not auth secrets, storage objects, provider configuration or database roles.
create or replace function public.export_application_backup() returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '30s' as $$
declare payload jsonb;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 select jsonb_build_object(
  'format','gns-application-backup','version',1,'schemaVersion',13,
  'createdAt',statement_timestamp(),'tables',jsonb_build_object(
   'user_roles',(select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]') from public.user_roles t),
   'members',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.members t),
   'member_admin_notes',(select coalesce(jsonb_agg(to_jsonb(t) order by member_id),'[]') from public.member_admin_notes t),
   'routines',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.routines t),
   'memberships',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.memberships t),
   'payments',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.payments t),
   'sessions',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.sessions t),
   'session_reviews',(select coalesce(jsonb_agg(to_jsonb(t) order by session_id),'[]') from public.session_reviews t),
   'health_records',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.health_records t),
   'member_progress',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.member_progress t),
   'service_requests',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.service_requests t),
   'privacy_requests',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.privacy_requests t)
  )) into payload;
 if octet_length(payload::text) > 50000000 then raise exception 'Solicitar respaldo completo al proveedor: tamaño excedido'; end if;
 return payload;
end; $$;
revoke all on function public.export_application_backup() from public,anon;
grant execute on function public.export_application_backup() to authenticated;
notify pgrst, 'reload schema';
commit;
