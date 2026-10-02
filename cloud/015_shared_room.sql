begin;
-- One physical room. PostgreSQL, rather than the browser, arbitrates overlaps.
create table if not exists public.room_appointments (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.members(id) on delete cascade,
 membership_id uuid references public.memberships(id) on delete cascade,
 kind text not null check(kind in ('physio','reiki','akashic')),
 session_date date not null,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 cancelled boolean not null default false,
 created_at timestamptz not null default now(),
 constraint room_service_plan check((kind='physio') = (membership_id is not null)),
 constraint room_duration check(ends_at=starts_at+interval '35 minutes'),
 constraint room_local_day check(session_date=(starts_at at time zone 'America/Montevideo')::date and session_date=(ends_at at time zone 'America/Montevideo')::date),
 constraint room_plan_date unique(membership_id,session_date),
 constraint room_no_overlap exclude using gist (tstzrange(starts_at,ends_at,'[)') with &&) where (not cancelled)
);
alter table public.room_appointments enable row level security;
revoke all on public.room_appointments from public,anon,authenticated;
grant select on public.room_appointments to authenticated;
drop policy if exists room_admin_read on public.room_appointments;
create policy room_admin_read on public.room_appointments for select to authenticated using(private.is_admin());

create or replace function private.sync_physio_room() returns trigger
language plpgsql security definer set search_path='' as $$
declare times jsonb:=coalesce(new.service_config->'physioTimes','{}'); day_text text; clock_text text; moment timestamptz;
begin
 if jsonb_typeof(times) is distinct from 'object' then raise exception 'Horarios inválidos'; end if;
 -- Serialize schedule changes and the pending-date check used for holistic sessions.
 perform pg_advisory_xact_lock(6817642980::bigint);
 for day_text,clock_text in select key,value from jsonb_each_text(times) loop
  if not coalesce((new.service_config->'physioDates') ? day_text,false)
    or clock_text is null or clock_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or clock_text > '23:24' then raise exception 'Fecha u horario de kinesiología inválido'; end if;
  moment := (day_text||' '||clock_text)::timestamp at time zone 'America/Montevideo';
  insert into public.room_appointments(member_id,membership_id,kind,session_date,starts_at,ends_at)
   values(new.member_id,new.id,'physio',day_text::date,moment,moment+interval '35 minutes')
   on conflict(membership_id,session_date) do update set member_id=excluded.member_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,cancelled=false;
 end loop;
 update public.room_appointments set cancelled=true where membership_id=new.id and not cancelled and not (times ? session_date::text);
 return new;
end; $$;
revoke all on function private.sync_physio_room() from public,anon,authenticated;
drop trigger if exists sync_physio_room on public.memberships;
create trigger sync_physio_room after insert or update of service_config,member_id on public.memberships for each row execute function private.sync_physio_room();

create or replace function public.book_holistic_session(p_id uuid,p_member uuid,p_kind text,p_date date,p_time text)
returns uuid language plpgsql security definer set search_path='' as $$
declare moment timestamptz; previous public.room_appointments;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 if p_id is null or p_date is null or p_kind is null or p_kind not in ('reiki','akashic') or p_time is null
   or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_time > '23:24' then raise exception 'Turno inválido'; end if;
 moment := (p_date::text||' '||p_time)::timestamp at time zone 'America/Montevideo';
 perform pg_advisory_xact_lock(6817642980::bigint);
 select * into previous from public.room_appointments where id=p_id;
 if found then
  if previous.member_id=p_member and previous.kind=p_kind and previous.starts_at=moment and not previous.cancelled then return p_id; end if;
  raise exception 'La solicitud ya existe con otros datos';
 end if;
 if moment < now() then raise exception 'Elegí un horario futuro'; end if;
 if exists(select 1 from public.memberships m where (m.service_config->'physioDates') ? p_date::text
   and not exists(select 1 from public.room_appointments a where a.membership_id=m.id and a.session_date=p_date and not a.cancelled)) then
  raise exception 'Hay sesiones de kinesiología sin hora en esta fecha. Completá sus horarios primero.';
 end if;
 insert into public.room_appointments(id,member_id,kind,session_date,starts_at,ends_at)
  values(p_id,p_member,p_kind,p_date,moment,moment+interval '35 minutes');
 return p_id;
end; $$;
create or replace function public.cancel_holistic_session(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(6817642980::bigint);
 update public.room_appointments set cancelled=true where id=p_id and kind in ('reiki','akashic');
end; $$;
revoke all on function public.book_holistic_session(uuid,uuid,text,date,text),public.cancel_holistic_session(uuid) from public,anon;
grant execute on function public.book_holistic_session(uuid,uuid,text,date,text),public.cancel_holistic_session(uuid) to authenticated;
drop trigger if exists gns_security_audit on public.room_appointments;
create trigger gns_security_audit after insert or update or delete on public.room_appointments for each row execute function private.record_security_audit();
create or replace function public.export_application_backup() returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '30s' as $$
declare payload jsonb;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 select jsonb_build_object(
  'format','gns-application-backup','version',1,'schemaVersion',15,
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
