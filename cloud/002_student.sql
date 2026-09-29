-- Ejecutar UNA vez en el editor SQL del proyecto Supabase existente.
-- No volver a ejecutar 001_initial.sql ni el importador.
-- Registro de próximo día por un alumno autenticado, en una sola transacción.
create or replace function public.student_register_next_day(
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
revoke all on function public.student_register_next_day(uuid, uuid, date, text, jsonb) from public;
revoke all on function public.student_register_next_day(uuid, uuid, date, text, jsonb) from anon;
grant execute on function public.student_register_next_day(uuid, uuid, date, text, jsonb) to authenticated;
