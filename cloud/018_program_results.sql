begin;
create table if not exists public.program_results (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.members(id) on delete cascade,
 routine_id uuid not null unique references public.routines(id) on delete cascade,
 program_name text not null,
 evaluated_on date not null,
 observations text not null check(length(btrim(observations)) between 1 and 4000),
 comparison text not null default '' check(length(comparison)<=4000),
 next_steps text not null default '' check(length(next_steps)<=4000),
 revision integer not null check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.program_results enable row level security;
revoke all on public.program_results from public,anon,authenticated;
grant select on public.program_results to authenticated;
drop policy if exists program_results_read on public.program_results;
create policy program_results_read on public.program_results for select to authenticated using (
 private.is_admin() or private.owns_student_member(member_id)
);
create or replace function public.save_program_result(p_member uuid,p_routine uuid,p_date date,p_observations text,p_comparison text,p_next_steps text,p_expected integer)
returns integer language plpgsql security definer set search_path='' as $$
declare current_revision integer; next_revision integer; routine_name text;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 perform 1 from public.members where id=p_member for update;
 if not found then raise exception 'Socio inexistente'; end if;
 select name into routine_name from public.routines where id=p_routine and member_id=p_member for update;
 if not found then raise exception 'El programa no pertenece al socio' using errcode='42501'; end if;
 if p_date is null or p_date > (now() at time zone 'America/Montevideo')::date then raise exception 'Fecha de evaluación no válida'; end if;
 select revision into current_revision from public.program_results where routine_id=p_routine;
 if p_expected is null or coalesce(current_revision,0)<>p_expected then raise exception 'La evaluación cambió. Recargá antes de guardar.' using errcode='40001'; end if;
 next_revision:=coalesce(current_revision,0)+1;
 insert into public.program_results(member_id,routine_id,program_name,evaluated_on,observations,comparison,next_steps,revision)
 values(p_member,p_routine,routine_name,p_date,btrim(p_observations),btrim(p_comparison),btrim(p_next_steps),next_revision)
 on conflict(routine_id) do update set program_name=excluded.program_name,evaluated_on=excluded.evaluated_on,observations=excluded.observations,comparison=excluded.comparison,next_steps=excluded.next_steps,revision=excluded.revision,updated_at=now();
 return next_revision;
end; $$;
revoke all on function public.save_program_result(uuid,uuid,date,text,text,text,integer) from public,anon;
grant execute on function public.save_program_result(uuid,uuid,date,text,text,text,integer) to authenticated;
drop trigger if exists gns_security_audit on public.program_results;
create trigger gns_security_audit after insert or update or delete on public.program_results for each row execute function private.record_security_audit();

create or replace function public.export_application_backup() returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '30s' as $$
declare payload jsonb;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 select jsonb_build_object(
  'format','gns-application-backup','version',1,'schemaVersion',18,
  'createdAt',statement_timestamp(),'tables',jsonb_build_object(
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
