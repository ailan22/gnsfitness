-- Aplicar junto con la actualización del portal. Los clientes antiguos deben recargar.
begin;
create or replace function private.student_register_next_day_impl(
  p_request_id uuid, p_routine_id uuid, p_performed_at date, p_notes text, p_results jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_member_id uuid;
  v_routine public.routines%rowtype;
  v_day integer := 1;
  v_expected integer := 1;
  v_completed integer := 0;
  v_last_day integer := 0;
  v_last_date date;
  v_block integer;
  v_week integer;
  v_id uuid := p_request_id;
  v_entry jsonb;
  v_unique_name boolean;
  v_record record;
begin
  if (select auth.uid()) is null then raise exception 'Cuenta no autenticada'; end if;
  select m.id into v_member_id from public.members m
    join public.user_roles r on r.user_id = (select auth.uid()) and r.role = 'student'
    where m.user_id = (select auth.uid()) and m.status = 'Activo';
  if v_member_id is null then raise exception 'Cuenta de alumno sin ficha activa'; end if;
  -- Serializar registros de este alumno, también si se envían desde dos dispositivos.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_member_id::text), 971045);
  if v_id is null then raise exception 'Identificador de solicitud obligatorio'; end if;
  if exists (select 1 from public.sessions s where s.id = v_id and s.member_id = v_member_id) then return v_id; end if;
  select * into v_routine from public.routines
    where id = p_routine_id and member_id = v_member_id;
  if not found then raise exception 'Rutina no asignada'; end if;
  if exists (select 1 from public.routines r where r.member_id = v_member_id and r.created_at > v_routine.created_at) then
    raise exception 'Usá la rutina más reciente'; end if;
  select count(*) = 1 into v_unique_name from public.routines r
    where r.member_id = v_member_id and r.name = v_routine.name;
  if p_performed_at is null or p_performed_at > (now() at time zone 'America/Montevideo')::date
    or p_performed_at < date '2000-01-01' then raise exception 'Fecha no válida'; end if;
  if pg_catalog.length(coalesce(p_notes, '')) > 4000 then raise exception 'Observaciones demasiado largas'; end if;
  if p_results is null or jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 100 then
    raise exception 'Resultados no válidos'; end if;
  for v_entry in select value from jsonb_array_elements(p_results) loop
    if jsonb_typeof(v_entry) <> 'object' or coalesce(v_entry->>'name', '') = '' or pg_catalog.length(v_entry->>'name') > 200
      or pg_catalog.length(v_entry->>'sets') > 60 or pg_catalog.length(v_entry->>'reps') > 60
      or pg_catalog.length(v_entry->>'load') > 60 or pg_catalog.length(v_entry->>'rir') > 60 then
      raise exception 'Resultado inválido'; end if;
  end loop;
  for v_record in
    select s.day, s.performed_at from public.sessions s
    where s.member_id = v_member_id and (s.routine_id = p_routine_id or (s.routine_id is null and v_unique_name and s.routine_name = v_routine.name)) and s.day is not null
      and s.performed_at <= (now() at time zone 'America/Montevideo')::date
    order by s.performed_at, s.created_at, s.id
  loop
    v_last_date := v_record.performed_at;
    v_last_day := v_record.day;
    if v_record.day = v_expected then
      if v_expected = v_routine.days_per_week then v_completed := v_completed + 1; v_expected := 1;
      else v_expected := v_expected + 1; end if;
    elsif v_record.day = 1 then
      if v_routine.days_per_week = 1 then v_expected := 1;
      else v_expected := 2; end if;
    end if;
  end loop;
  if v_completed >= v_routine.program_rounds then raise exception 'Programa completado'; end if;
  if v_last_date is not null and p_performed_at < v_last_date then raise exception 'Fecha anterior al último día registrado'; end if;
  v_day := (v_last_day % v_routine.days_per_week) + 1;
  v_block := least((v_completed / v_routine.block_rounds) + 1, ceil(v_routine.program_rounds::numeric / v_routine.block_rounds)::integer);
  v_week := v_completed + 1;
  insert into public.sessions (id, member_id, performed_at, routine_id, routine_name, day, block, week, notes, results)
    values (v_id, v_member_id, p_performed_at, v_routine.id, v_routine.name, v_day, v_block, v_week, coalesce(p_notes, ''), p_results);
  return v_id;
end;
$$;

revoke all on function private.student_register_next_day_impl(uuid,uuid,date,text,jsonb) from public, anon, authenticated;

-- All writers of a member's session history share the same transaction lock.
create or replace function private.lock_training_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP = 'UPDATE' and (new.member_id <> old.member_id or new.id <> old.id) then
   raise exception 'No se puede trasladar el entrenamiento';
 end if;
 if TG_OP = 'DELETE' then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(old.member_id::text),971045);
   return old;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.member_id::text),971045);
 return new;
end;
$$;
revoke all on function private.lock_training_history() from public, anon, authenticated;
drop trigger if exists lock_training_history on public.sessions;
create trigger lock_training_history before insert or update or delete on public.sessions
for each row execute function private.lock_training_history();

create or replace function public.student_register_next_day_checked(
 p_request_id uuid, p_routine_id uuid, p_performed_at date, p_notes text, p_results jsonb,
 p_expected_last_id uuid, p_expected_day integer, p_expected_week integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_member uuid; v_last uuid; v_existing public.sessions%rowtype; v_created public.sessions%rowtype; v_id uuid;
begin
 select m.id into v_member from public.members m join public.user_roles r on r.user_id = m.user_id
 where m.user_id = (select auth.uid()) and r.role = 'student' and m.status = 'Activo';
 if v_member is null then raise exception 'Cuenta de alumno sin ficha activa' using errcode = '42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_member::text),971045);
 select * into v_existing from public.sessions where id = p_request_id;
 if found then
   if v_existing.member_id is distinct from v_member or v_existing.routine_id is distinct from p_routine_id
    or v_existing.performed_at is distinct from p_performed_at or v_existing.notes is distinct from coalesce(p_notes,'')
    or v_existing.results is distinct from p_results then raise exception 'Solicitud ya usada con otros datos'; end if;
   return p_request_id;
 end if;
 select s.id into v_last from public.sessions s join public.routines r on r.id = p_routine_id and r.member_id = v_member
 where s.member_id = v_member and s.day is not null and s.performed_at <= (now() at time zone 'America/Montevideo')::date
 and (s.routine_id = r.id or (s.routine_id is null and s.routine_name = r.name and
   (select count(*) from public.routines x where x.member_id = v_member and x.name = r.name) = 1))
 order by s.performed_at desc, s.created_at desc, s.id desc limit 1;
 if v_last is distinct from p_expected_last_id then raise exception 'El entrenamiento cambió. Actualizá tu panel'; end if;
 v_id := private.student_register_next_day_impl(p_request_id,p_routine_id,p_performed_at,p_notes,p_results);
 select * into v_created from public.sessions where id = v_id;
 if v_created.day is distinct from p_expected_day or v_created.week is distinct from p_expected_week then
   raise exception 'El día esperado cambió. Actualizá tu panel';
 end if;
 return v_id;
end;
$$;
revoke all on function public.student_register_next_day_checked(uuid,uuid,date,text,jsonb,uuid,integer,integer) from public, anon;
grant execute on function public.student_register_next_day_checked(uuid,uuid,date,text,jsonb,uuid,integer,integer) to authenticated;

-- Older clients must reload; leaving this entry point active would bypass the precondition.
create or replace function public.student_register_next_day(
 p_request_id uuid, p_routine_id uuid, p_performed_at date, p_notes text, p_results jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
 raise exception 'Actualizá la aplicación para registrar el entrenamiento con la nueva protección';
end;
$$;
revoke all on function public.student_register_next_day(uuid,uuid,date,text,jsonb) from public, anon;
grant execute on function public.student_register_next_day(uuid,uuid,date,text,jsonb) to authenticated;
create or replace function public.gns_integrity_version() returns integer language sql stable security invoker set search_path = '' as $$ select 5 $$;
revoke all on function public.gns_integrity_version() from public, anon;
grant execute on function public.gns_integrity_version() to authenticated;
commit;
