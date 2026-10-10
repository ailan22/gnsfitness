begin;
set local lock_timeout = '5s';
create table if not exists public.registration_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 first_name text not null check(char_length(first_name) between 1 and 80),
 last_name text not null check(char_length(last_name) between 1 and 80),
 email text not null check(char_length(email) between 3 and 254),
 phone text not null default '' check(char_length(phone)<=30),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid,
 member_id uuid references public.members(id) on delete set null
);
alter table public.registration_requests enable row level security;
revoke all on public.registration_requests from public,anon,authenticated;
grant select on public.registration_requests to authenticated;
drop policy if exists registration_read on public.registration_requests;
create policy registration_read on public.registration_requests for select to authenticated
 using(user_id=(select auth.uid()) or private.is_admin());
create index if not exists registration_pending_idx on public.registration_requests(created_at,user_id) where status='pending';

create or replace function public.submit_registration(p_first_name text,p_last_name text,p_phone text default '')
returns text language plpgsql security definer set search_path='' as $$
declare u jsonb; e text; result text;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión y confirmá tu correo' using errcode='42501'; end if;
 select to_jsonb(a) into u from auth.users a where id=auth.uid() for update;
 if u is null or nullif(u->>'email_confirmed_at','') is null then raise exception 'Confirmá tu correo antes de solicitar acceso' using errcode='42501'; end if;
 if exists(select 1 from public.user_roles where user_id=auth.uid()) then raise exception 'Esta cuenta ya tiene acceso asignado'; end if;
 e:=lower(trim(u->>'email'));
 if e is null or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo no válido'; end if;
 if p_first_name is null or char_length(trim(p_first_name)) not between 1 and 80
 or p_last_name is null or char_length(trim(p_last_name)) not between 1 and 80
 or char_length(coalesce(trim(p_phone),''))>30 then raise exception 'Revisá el nombre, apellido y celular'; end if;
 insert into public.registration_requests(user_id,first_name,last_name,email,phone)
 values(auth.uid(),trim(p_first_name),trim(p_last_name),e,coalesce(trim(p_phone),'')) on conflict(user_id) do nothing;
 select status into result from public.registration_requests where user_id=auth.uid();
 return result;
end $$;

create or replace function public.decide_registration(p_user_id uuid,p_approve boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.registration_requests%rowtype; u jsonb; m public.members%rowtype; e text; total integer; new_id uuid;
begin
 if not private.is_admin() then raise exception 'Se requiere administrador con doble factor' using errcode='42501'; end if;
 if p_approve is null then raise exception 'Indicá la decisión'; end if;
 select * into r from public.registration_requests where user_id=p_user_id for update;
 if not found then raise exception 'La solicitud ya no existe'; end if;
 if r.status<>'pending' then raise exception 'La solicitud ya fue resuelta; actualizá la lista'; end if;
 if not p_approve then
  update public.registration_requests set status='rejected',decided_at=now(),decided_by=auth.uid() where user_id=p_user_id;
 else
  select to_jsonb(a) into u from auth.users a where id=p_user_id for update;
  e:=lower(trim(u->>'email'));
  if nullif(u->>'email_confirmed_at','') is null or e is distinct from r.email then raise exception 'El correo cambió o no está confirmado'; end if;
  if exists(select 1 from public.user_roles where user_id=p_user_id) then raise exception 'La cuenta ya tiene un rol; revisá su ficha'; end if;
  perform pg_advisory_xact_lock(hashtextextended(e,0));
  select count(*) into total from public.members where lower(trim(email))=e or user_id=p_user_id;
  if total>1 then raise exception 'Hay fichas con el mismo correo; corregí el duplicado antes de aprobar'; end if;
  if total=1 then
   select * into m from public.members where lower(trim(email))=e or user_id=p_user_id for update;
   if m.status<>'Activo' then raise exception 'La ficha existente no está activa; revisala antes de aprobar'; end if;
   if m.user_id is not null and m.user_id<>p_user_id then raise exception 'La ficha pertenece a otra cuenta'; end if;
   if lower(trim(m.email)) is distinct from e then raise exception 'El correo de la ficha no coincide'; end if;
   new_id:=m.id;
   update public.members set user_id=p_user_id where id=m.id;
  else
   new_id:=gen_random_uuid();
   insert into public.members(id,user_id,first_name,last_name,email,phone,joined_at,status)
    values(new_id,p_user_id,r.first_name,r.last_name,e,r.phone,(now() at time zone 'America/Montevideo')::date,'Activo');
  end if;
  insert into public.user_roles(user_id,role) values(p_user_id,'student');
  update public.registration_requests set status='approved',member_id=new_id,decided_at=now(),decided_by=auth.uid() where user_id=p_user_id;
 end if;
 insert into private.security_audit(actor_id,entity_table,entity_id,operation) values(auth.uid(),'registration_requests',p_user_id,'UPDATE');
 return new_id;
end $$;
revoke all on function public.submit_registration(text,text,text),public.decide_registration(uuid,boolean) from public,anon,authenticated;
grant execute on function public.submit_registration(text,text,text),public.decide_registration(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
