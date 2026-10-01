begin;
-- Separate internal assessment/draft from the exact text released to the student.
create table if not exists public.nutrition_drafts (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null unique references public.members(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 120),
 body text not null check(length(body)<=20000),
 assessment jsonb not null default '{}' check(jsonb_typeof(assessment)='object' and octet_length(assessment::text)<=12000),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
create table if not exists public.nutrition_plans (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null unique references public.members(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 120),
 body text not null check(length(btrim(body)) between 1 and 20000),
 draft_revision integer not null,
 published_at timestamptz not null default now(),
 active boolean not null default true
);
alter table public.nutrition_drafts enable row level security;
alter table public.nutrition_plans enable row level security;
revoke all on public.nutrition_drafts,public.nutrition_plans from public,anon,authenticated;
grant select on public.nutrition_drafts,public.nutrition_plans to authenticated;
drop policy if exists nutrition_drafts_read on public.nutrition_drafts;
create policy nutrition_drafts_read on public.nutrition_drafts for select to authenticated using(private.is_admin());
drop policy if exists nutrition_plans_read on public.nutrition_plans;
create policy nutrition_plans_read on public.nutrition_plans for select to authenticated using(
 private.is_admin() or (active and private.owns_student_member(member_id) and exists(
 select 1 from public.service_requests s where s.member_id=nutrition_plans.member_id and s.service='nutrition' and s.status='enabled'))
);
create or replace function public.save_nutrition_draft(p_member uuid,p_title text,p_body text,p_assessment jsonb,p_expected integer)
returns integer language plpgsql security definer set search_path='' as $$
declare current_revision integer; next_revision integer;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 perform 1 from public.members where id=p_member for update;
 if not found then raise exception 'Socio inexistente'; end if;
 select revision into current_revision from public.nutrition_drafts where member_id=p_member;
 if p_expected is null or coalesce(current_revision,0)<>p_expected then raise exception 'La ficha cambió. Recargá antes de guardar.' using errcode='40001'; end if;
 next_revision:=coalesce(current_revision,0)+1;
 insert into public.nutrition_drafts(member_id,title,body,assessment,revision) values(p_member,btrim(p_title),p_body,p_assessment,next_revision)
 on conflict(member_id) do update set title=excluded.title,body=excluded.body,assessment=excluded.assessment,revision=excluded.revision,updated_at=now();
 return next_revision;
end; $$;
create or replace function public.publish_nutrition_plan(p_member uuid,p_expected integer)
returns void language plpgsql security definer set search_path='' as $$
declare draft public.nutrition_drafts;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 perform 1 from public.members where id=p_member for update;
 if not found then raise exception 'Socio inexistente'; end if;
 select * into draft from public.nutrition_drafts where member_id=p_member;
 if draft.id is null or p_expected is null or draft.revision<>p_expected then raise exception 'Guardá y revisá la versión actual antes de enviar.' using errcode='40001'; end if;
 if not exists(select 1 from public.members where id=p_member and user_id is not null) then raise exception 'El socio necesita una cuenta vinculada.'; end if;
 if not exists(select 1 from public.service_requests where member_id=p_member and service='nutrition' and status='enabled') then raise exception 'Primero habilitá Nutrición para este socio.'; end if;
 insert into public.nutrition_plans(member_id,title,body,draft_revision) values(p_member,draft.title,draft.body,draft.revision)
 on conflict(member_id) do update set title=excluded.title,body=excluded.body,draft_revision=excluded.draft_revision,published_at=now(),active=true
 where nutrition_plans.draft_revision<>excluded.draft_revision or not nutrition_plans.active;
end; $$;
create or replace function public.enable_personal_nutrition(p_member uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 if not exists(select 1 from public.members where id=p_member and user_id is not null) then raise exception 'Vinculá la cuenta del socio primero.'; end if;
 insert into public.service_requests(member_id,service,status,decided_at,decided_by) values(p_member,'nutrition','enabled',now(),auth.uid())
 on conflict(member_id,service) do update set status='enabled',decided_at=now(),decided_by=auth.uid();
end; $$;
revoke all on function public.enable_personal_nutrition(uuid) from public,anon;
grant execute on function public.enable_personal_nutrition(uuid) to authenticated;
create or replace function public.withdraw_nutrition_plan(p_member uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 update public.nutrition_plans set active=false where member_id=p_member;
end; $$;
revoke all on function public.save_nutrition_draft(uuid,text,text,jsonb,integer),public.publish_nutrition_plan(uuid,integer),public.withdraw_nutrition_plan(uuid) from public,anon;
grant execute on function public.save_nutrition_draft(uuid,text,text,jsonb,integer),public.publish_nutrition_plan(uuid,integer),public.withdraw_nutrition_plan(uuid) to authenticated;
do $$ declare name text; begin
 foreach name in array array['nutrition_drafts','nutrition_plans'] loop
 execute format('drop trigger if exists gns_security_audit on public.%I',name);
 execute format('create trigger gns_security_audit after insert or update or delete on public.%I for each row execute function private.record_security_audit()',name);
 end loop;
end; $$;
create or replace function public.export_application_backup() returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '30s' as $$
declare payload jsonb;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 select jsonb_build_object(
  'format','gns-application-backup','version',1,'schemaVersion',14,
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
