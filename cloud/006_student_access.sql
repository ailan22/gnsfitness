begin;
create table if not exists private.student_access_attempts (
 member_id uuid primary key references public.members(id) on delete cascade,
 requested_at timestamptz not null, requested_by uuid not null
);
alter table private.student_access_attempts enable row level security;
revoke all on private.student_access_attempts from public, anon, authenticated;

create or replace function public.prepare_student_access(p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.members%rowtype; u uuid; r text; last_request timestamptz; e text;
begin
 if not private.is_admin() then raise exception 'Solo el administrador puede habilitar accesos' using errcode='42501'; end if;
 select * into m from public.members where id=p_member_id for update;
 if not found or m.status <> 'Activo' then raise exception 'El socio debe existir y estar activo'; end if;
 e := lower(trim(m.email));
 if e = '' or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Revisá el correo de la ficha'; end if;
 if exists(select 1 from public.members where id<>m.id and lower(trim(email))=e) then raise exception 'El correo está repetido en otra ficha'; end if;
 select id into u from auth.users where lower(email)=e;
 if m.user_id is not null and m.user_id is distinct from u then raise exception 'El correo no coincide con la cuenta vinculada'; end if;
 if u is not null then
  select role into r from public.user_roles where user_id=u;
  if r is not null and r <> 'student' then raise exception 'Esta cuenta tiene un rol de personal; no se puede convertir en alumno'; end if;
  if exists(select 1 from public.members where user_id=u and id<>m.id) then raise exception 'La cuenta ya está vinculada a otro socio'; end if;
 end if;
 select requested_at into last_request from private.student_access_attempts where member_id=m.id;
 if last_request > now()-interval '60 seconds' then raise exception 'Esperá un minuto antes de reintentar'; end if;
 insert into private.student_access_attempts values(m.id,now(),auth.uid())
 on conflict(member_id) do update set requested_at=excluded.requested_at,requested_by=excluded.requested_by;
 return jsonb_build_object('email',e,'user_id',u);
end;
$$;

create or replace function public.finish_student_access(p_member_id uuid,p_user_id uuid,p_expected_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m public.members%rowtype; e text; r text;
begin
 if not private.is_admin() then raise exception 'Solo el administrador puede habilitar accesos' using errcode='42501'; end if;
 select * into m from public.members where id=p_member_id for update;
 if not found or m.status<>'Activo' then raise exception 'Socio no disponible'; end if;
 if lower(trim(m.email)) is distinct from p_expected_email then raise exception 'El correo cambió; actualizá la ficha'; end if;
 select lower(email) into e from auth.users where id=p_user_id for update;
 if not found or e is distinct from p_expected_email then raise exception 'La cuenta no coincide con el correo del socio'; end if;
 if m.user_id is not null and m.user_id<>p_user_id then raise exception 'La ficha ya tiene otra cuenta'; end if;
 if exists(select 1 from public.members where id<>m.id and (user_id=p_user_id or lower(trim(email))=e)) then raise exception 'Correo o cuenta en otra ficha'; end if;
 insert into public.user_roles(user_id,role) values(p_user_id,'student') on conflict(user_id) do nothing;
 select role into r from public.user_roles where user_id=p_user_id for update;
 if r is distinct from 'student' then raise exception 'No se puede modificar el rol de esta cuenta'; end if;
 update public.members set user_id=p_user_id where id=m.id;
 return p_user_id;
end;
$$;
revoke all on function public.prepare_student_access(uuid) from public,anon;
revoke all on function public.finish_student_access(uuid,uuid,text) from public,anon;
grant execute on function public.prepare_student_access(uuid) to authenticated;
grant execute on function public.finish_student_access(uuid,uuid,text) to authenticated;
commit;
