begin;
create table public.gym_business_settings (
 id uuid primary key default '00000000-0000-0000-0000-000000000001' check(id='00000000-0000-0000-0000-000000000001'),
 business_type text not null default 'Unipersonal' check(business_type='Unipersonal'),
 tax_regime text not null check(tax_regime in ('IVA mínimo','Régimen general','Monotributo','Otro / consultar')),
 employee_count integer not null check(employee_count between 0 and 10000),
 version integer not null default 1,
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id)
);
insert into public.gym_business_settings(tax_regime,employee_count) values('IVA mínimo',1);
alter table public.gym_business_settings enable row level security;
revoke all on public.gym_business_settings from public,anon,authenticated;
grant select on public.gym_business_settings to authenticated;
create policy business_admin_read on public.gym_business_settings for select to authenticated using(private.is_admin());
create function public.save_gym_business_settings(p_expected_version integer,p_tax_regime text,p_employee_count integer) returns integer
language plpgsql security definer set search_path='' as $$
declare current_row public.gym_business_settings;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 select * into strict current_row from public.gym_business_settings for update;
 if p_expected_version is null or current_row.version<>p_expected_version then
  if current_row.version=p_expected_version+1 and current_row.tax_regime=p_tax_regime and current_row.employee_count=p_employee_count then return current_row.version; end if;
  raise exception 'La configuración cambió' using errcode='40001';
 end if;
 update public.gym_business_settings set tax_regime=p_tax_regime,employee_count=p_employee_count,version=version+1,updated_at=now(),updated_by=auth.uid();
 return current_row.version+1;
end; $$;
revoke all on function public.save_gym_business_settings(integer,text,integer) from public,anon;
grant execute on function public.save_gym_business_settings(integer,text,integer) to authenticated;
create or replace function public.export_application_backup() returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '30s' as $$
declare payload jsonb;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 select jsonb_build_object(
  'format','gns-application-backup','version',1,'schemaVersion',27,
  'createdAt',statement_timestamp(),'tables',jsonb_build_object(
   'gym_business_settings',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.gym_business_settings t),
   'gym_expenses',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.gym_expenses t),
   'gym_expense_history',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.gym_expense_history t),
   'program_results',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.program_results t),
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
   'nutrition_drafts',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.nutrition_drafts t),
   'room_appointments',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.room_appointments t),
   'nutrition_plans',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.nutrition_plans t),
   'privacy_requests',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.privacy_requests t)
  )) into payload;
 if octet_length(payload::text) > 50000000 then raise exception 'Solicitar respaldo completo al proveedor: tamaño excedido'; end if;
 return payload;
end; $$;
revoke all on function public.export_application_backup() from public,anon;
grant execute on function public.export_application_backup() to authenticated;

notify pgrst,'reload schema';
commit;
