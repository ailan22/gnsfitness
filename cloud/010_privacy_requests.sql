-- Manual privacy rights workflow; never deletes clinical or financial records implicitly.
begin;
create table if not exists public.privacy_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('access','correction','deletion')),
 status text not null default 'pending' check(status in ('pending','completed')),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 resolution text not null default '' check(length(resolution)<=2000)
);
create unique index if not exists privacy_request_pending on public.privacy_requests(user_id,kind) where status='pending';
alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from public,anon,authenticated;
grant select on public.privacy_requests to authenticated;
drop policy if exists privacy_requests_read on public.privacy_requests;
create policy privacy_requests_read on public.privacy_requests for select to authenticated using(user_id=(select auth.uid()) or private.is_admin());
create or replace function public.request_privacy_action(p_kind text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then raise exception 'Cuenta requerida'; end if;
 if p_kind is null or p_kind not in ('access','correction','deletion') then raise exception 'Solicitud inválida'; end if;
 insert into public.privacy_requests(user_id,kind) values(auth.uid(),p_kind)
 on conflict(user_id,kind) where status='pending' do update set kind=excluded.kind returning id into result;
 return result;
end; $$;
create or replace function public.complete_privacy_request(p_id uuid,p_resolution text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrador con segundo factor requerido'; end if;
 if length(btrim(coalesce(p_resolution,'')))<10 or length(p_resolution)>2000 then raise exception 'Registrar respuesta y actuaciones realizadas'; end if;
 update public.privacy_requests set status='completed',completed_at=now(),resolution=btrim(p_resolution) where id=p_id and status='pending';
 if not found then raise exception 'Solicitud no pendiente'; end if;
end; $$;
revoke all on function public.request_privacy_action(text),public.complete_privacy_request(uuid,text) from public,anon;
grant execute on function public.request_privacy_action(text),public.complete_privacy_request(uuid,text) to authenticated;
commit;
