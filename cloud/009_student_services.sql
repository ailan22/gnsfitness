-- Additive services and self-reported progress. Requires 001-008.
begin;
create or replace function private.owns_student_member(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.members m join public.user_roles r on r.user_id=m.user_id where m.id=target and m.user_id=auth.uid() and r.role='student');
$$;
revoke all on function private.owns_student_member(uuid) from public,anon;
grant execute on function private.owns_student_member(uuid) to authenticated;
create table if not exists public.member_progress (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id) on delete cascade,
 measured_on date not null check(measured_on between date '1900-01-01' and current_date),
 metric text not null check(metric in ('weight','waist','hip','arm','thigh')),
 value numeric(5,1) not null check(value>0 and value<=500), created_at timestamptz not null default now(),
 unique(member_id,metric,measured_on)
);
create table if not exists public.service_requests (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id) on delete cascade,
 service text not null check(service='nutrition'), status text not null default 'pending' check(status in ('pending','enabled','declined','revoked')),
 created_at timestamptz not null default now(), decided_at timestamptz, decided_by uuid references auth.users(id),
 unique(member_id,service)
);
alter table public.member_progress enable row level security;
alter table public.service_requests enable row level security;
revoke all on public.member_progress,public.service_requests from public,anon,authenticated;
grant select,insert,delete on public.member_progress to authenticated;
grant select on public.service_requests to authenticated;
drop policy if exists progress_read on public.member_progress;
create policy progress_read on public.member_progress for select to authenticated using(private.owns_student_member(member_id) or private.is_admin());
drop policy if exists progress_insert on public.member_progress;
create policy progress_insert on public.member_progress for insert to authenticated with check(private.owns_student_member(member_id));
drop policy if exists progress_delete on public.member_progress;
create policy progress_delete on public.member_progress for delete to authenticated using(private.owns_student_member(member_id));
drop policy if exists services_read on public.service_requests;
create policy services_read on public.service_requests for select to authenticated using(private.owns_student_member(member_id) or private.is_admin());
create or replace function public.request_nutrition_access() returns uuid language plpgsql security definer set search_path='' as $$
declare member uuid; request uuid;
begin
 select m.id into member from public.members m join public.user_roles r on r.user_id=m.user_id where m.user_id=auth.uid() and r.role='student';
 if member is null then raise exception 'Cuenta sin ficha de alumno'; end if;
 insert into public.service_requests(member_id,service) values(member,'nutrition') on conflict(member_id,service) do nothing returning id into request;
 if request is null then select id into request from public.service_requests where member_id=member and service='nutrition'; end if;
 return request;
end; $$;
create or replace function public.decide_service_request(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrador con segundo factor requerido'; end if;
 if p_status not in ('enabled','declined','revoked') or p_status is null then raise exception 'Estado inválido'; end if;
 update public.service_requests set status=p_status,decided_at=now(),decided_by=auth.uid() where id=p_id;
 if not found then raise exception 'Solicitud inexistente'; end if;
end; $$;
revoke all on function public.request_nutrition_access(),public.decide_service_request(uuid,text) from public,anon;
grant execute on function public.request_nutrition_access(),public.decide_service_request(uuid,text) to authenticated;
alter table public.memberships add column if not exists service_extras text[] not null default '{}';
alter table public.memberships add column if not exists service_details text not null default '';
alter table public.memberships drop constraint if exists memberships_service_extras_check;
alter table public.memberships add constraint memberships_service_extras_check check(service_extras <@ array['Kinesiología','Nutrición']::text[] and cardinality(service_extras)<=2 and array_position(service_extras,null) is null);
alter table public.memberships drop constraint if exists memberships_service_details_check;
alter table public.memberships add constraint memberships_service_details_check check(length(service_details)<=1000);
do $$ declare name text; begin
 foreach name in array array['member_progress','service_requests'] loop
 execute format('drop trigger if exists gns_security_audit on public.%I',name);
 execute format('create trigger gns_security_audit after insert or update or delete on public.%I for each row execute function private.record_security_audit()',name);
 end loop;
end; $$;
commit;
