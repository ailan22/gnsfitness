-- Deploy this additive RPC before the updated recorder. No historical rows change.
begin;
create or replace function public.staff_register_session_checked(
 p_row jsonb, p_suggested boolean, p_expected_last_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v public.sessions%rowtype; previous public.sessions%rowtype; r public.routines%rowtype;
 item jsonb; entry record; last_id uuid; last_date date; last_day integer:=0;
 completed integer:=0; expected integer:=1; unique_name boolean;
begin
 if jsonb_typeof(p_row) is distinct from 'object' or p_suggested is null
   or octet_length(p_row::text)>65536 then raise exception 'Registro inválido'; end if;
 v:=jsonb_populate_record(null::public.sessions,p_row);
 if not (private.is_admin() or private.is_assigned_trainer(v.member_id)) then
   raise exception 'Acceso de personal con doble factor requerido' using errcode='42501'; end if;
 if v.id is null or v.member_id is null or v.performed_at is null
   or v.performed_at<date '2000-01-01' or v.performed_at>(now() at time zone 'America/Montevideo')::date
   or length(coalesce(v.notes,''))>4000 or jsonb_typeof(v.results) is distinct from 'array' then
   raise exception 'Fecha o resultados inválidos'; end if;
 if jsonb_array_length(v.results)>100 then raise exception 'Demasiados resultados'; end if;
 for item in select value from jsonb_array_elements(v.results) loop
   if jsonb_typeof(item) is distinct from 'object' or coalesce(item->>'name','')=''
     or length(item->>'name')>200 or length(item->>'exerciseId')>200 then raise exception 'Ejercicio inválido'; end if;
   if exists(select 1 from jsonb_each(item) e where e.key in ('sets','reps','load','rir')
     and (jsonb_typeof(e.value) is distinct from 'string' or length(e.value #>> '{}')>60)) then
     raise exception 'Resultado inválido'; end if;
 end loop;
 perform pg_advisory_xact_lock(hashtext(v.member_id::text),971045);
 -- Resolve a lost response before checking whether the next day advanced.
 select * into previous from public.sessions where id=v.id;
 if found then
   if previous.member_id is distinct from v.member_id or previous.routine_id is distinct from v.routine_id
     or previous.performed_at is distinct from v.performed_at or previous.day is distinct from v.day
     or previous.week is distinct from v.week or previous.block is distinct from v.block
     or previous.routine_name is distinct from coalesce(v.routine_name,'')
     or previous.notes is distinct from coalesce(v.notes,'') or previous.results is distinct from v.results then
     raise exception 'Solicitud ya usada con otros datos'; end if;
   return v.id;
 end if;
 if v.routine_id is not null then
   select * into r from public.routines where id=v.routine_id and member_id=v.member_id for share;
   if not found or v.routine_name is distinct from r.name then raise exception 'Rutina no asignada'; end if;
 elsif v.day is not null or v.week is not null or v.block is not null or coalesce(v.routine_name,'')<>'' then
   raise exception 'Día sin rutina';
 end if;
 if v.day is not null and (v.day<1 or v.day>r.days_per_week or v.week is null or v.week<1
   or v.week>r.program_rounds or v.block is distinct from ((v.week-1)/r.block_rounds+1)) then
   raise exception 'Día o semana inválidos'; end if;
 if p_suggested then
   if v.routine_id is null or v.day is null then raise exception 'Rutina y día obligatorios'; end if;
   if not exists(select 1 from public.members where id=v.member_id and status='Activo') then
     raise exception 'Ficha inactiva'; end if;
   if exists(select 1 from public.routines where member_id=v.member_id and created_at>r.created_at) then
     raise exception 'Usá la rutina más reciente'; end if;
   select count(*)=1 into unique_name from public.routines where member_id=v.member_id and name=r.name;
   for entry in select s.id,s.day,s.performed_at from public.sessions s
     where s.member_id=v.member_id and s.day is not null and s.performed_at<=(now() at time zone 'America/Montevideo')::date
       and (s.routine_id=r.id or (s.routine_id is null and unique_name and s.routine_name=r.name))
     order by s.performed_at,s.created_at,s.id loop
     last_id:=entry.id; last_day:=entry.day; last_date:=entry.performed_at;
     if entry.day=expected then
       if expected=r.days_per_week then completed:=completed+1; expected:=1; else expected:=expected+1; end if;
     elsif entry.day=1 then expected:=case when r.days_per_week=1 then 1 else 2 end; end if;
   end loop;
   if last_id is distinct from p_expected_last_id or completed>=r.program_rounds
     or v.day is distinct from (last_day%r.days_per_week+1) or v.week is distinct from completed+1
     or v.performed_at<last_date then raise exception 'El entrenamiento cambió. Actualizá la ficha'; end if;
 end if;
 insert into public.sessions(id,member_id,performed_at,routine_id,routine_name,day,block,week,notes,results)
 values(v.id,v.member_id,v.performed_at,v.routine_id,coalesce(v.routine_name,''),v.day,v.block,v.week,coalesce(v.notes,''),v.results);
 return v.id;
end; $$;
revoke all on function public.staff_register_session_checked(jsonb,boolean,uuid) from public,anon;
grant execute on function public.staff_register_session_checked(jsonb,boolean,uuid) to authenticated;
-- Keep existing RLS-protected staff INSERT until native clients are updated.
-- Then apply FINALIZAR_REGISTRO_SEGURO.sql to retire the legacy write path.
notify pgrst, 'reload schema';
commit;
