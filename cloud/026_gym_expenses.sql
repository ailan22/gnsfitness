begin;
set local lock_timeout='5s';
create table public.gym_expenses (
 id uuid primary key,
 category text not null check (length(category) between 1 and 80),
 concept text not null check (length(trim(concept)) between 1 and 160),
 expense_type text not null check(expense_type in ('fixed','variable')),
 amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 due_date date not null,
 status text not null check(status in ('pending','paid','cancelled')),
 paid_date date,
 notes text not null default '' check(length(notes)<=2000),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 check((status='paid' and paid_date is not null) or (status<>'paid' and paid_date is null))
);
create index gym_expenses_due_idx on public.gym_expenses(due_date,id);
create table public.gym_expense_history (
 id uuid primary key default gen_random_uuid(),
 expense_id uuid not null references public.gym_expenses(id),
 version integer not null,
 recorded_at timestamptz not null default now(),
 recorded_by uuid not null references auth.users(id),
 snapshot jsonb not null,
 unique(expense_id,version)
);
alter table public.gym_expenses enable row level security;
alter table public.gym_expense_history enable row level security;
revoke all on public.gym_expenses,public.gym_expense_history from public,anon,authenticated;
grant select on public.gym_expenses,public.gym_expense_history to authenticated;
create policy expenses_admin_read on public.gym_expenses for select to authenticated using(private.is_admin());
create policy expenses_history_admin_read on public.gym_expense_history for select to authenticated using(private.is_admin());
create function public.save_gym_expense(p_id uuid,p_expected_version integer,p_data jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare existing public.gym_expenses; saved public.gym_expenses;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 if p_id is null or p_expected_version is null or p_expected_version<0 then raise exception 'Registro inválido'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,26));
 select * into existing from public.gym_expenses where id=p_id for update;
 if (existing.id is null and p_expected_version<>0) or (existing.id is not null and p_expected_version<>existing.version) then
  -- A retry of the same request is harmless; different data requires a refresh.
  if existing.id is not null and existing.version=p_expected_version+1 and
    (to_jsonb(existing)-array['id','version','created_at','updated_at','updated_by'])=p_data then return existing.version; end if;
  raise exception 'El gasto cambió. Actualizá la lista antes de editar.' using errcode='40001';
 end if;
 if (p_data->>'paid_date')::date > (now() at time zone 'America/Montevideo')::date then raise exception 'La fecha de pago no puede ser futura'; end if;
 insert into public.gym_expenses(id,category,concept,expense_type,amount_cents,due_date,status,paid_date,notes,updated_by)
 values(p_id,p_data->>'category',trim(p_data->>'concept'),p_data->>'expense_type',(p_data->>'amount_cents')::bigint,(p_data->>'due_date')::date,p_data->>'status',(p_data->>'paid_date')::date,coalesce(p_data->>'notes',''),auth.uid())
 on conflict(id) do update set category=excluded.category,concept=excluded.concept,expense_type=excluded.expense_type,amount_cents=excluded.amount_cents,due_date=excluded.due_date,status=excluded.status,paid_date=excluded.paid_date,notes=excluded.notes,version=public.gym_expenses.version+1,updated_at=now(),updated_by=auth.uid()
 returning * into saved;
 insert into public.gym_expense_history(expense_id,version,recorded_by,snapshot) values(saved.id,saved.version,auth.uid(),to_jsonb(saved));
 return saved.version;
end; $$;
revoke all on function public.save_gym_expense(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_gym_expense(uuid,integer,jsonb) to authenticated;
-- Export definition appended by the preparation script.

create or replace function public.export_application_backup() returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '30s' as $$
declare payload jsonb;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 select jsonb_build_object(
  'format','gns-application-backup','version',1,'schemaVersion',26,
  'createdAt',statement_timestamp(),'tables',jsonb_build_object(
   'gym_expenses',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.gym_expenses t),
   'gym_expense_history',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.gym_expense_history t),
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
