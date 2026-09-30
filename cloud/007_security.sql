-- Apply after 001-006. Transactional, repeatable, no personal data removal.
-- Deploy the MFA-capable application BEFORE applying this migration.
begin;

-- RLS does not protect TRUNCATE. Remove inherited Supabase default grants,
-- then grant only the operations protected by the existing row policies.
revoke all on public.user_roles, public.members, public.member_admin_notes,
  public.routines, public.memberships, public.payments, public.sessions,
  public.session_reviews from public, anon, authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.members, public.member_admin_notes,
  public.routines, public.memberships, public.payments, public.sessions,
  public.session_reviews to authenticated;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt())->>'aal' = 'aal2', false)
    and exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin');
$$;
create or replace function private.is_assigned_trainer(target_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt())->>'aal' = 'aal2', false)
    and exists (
      select 1 from public.members m join public.user_roles r on r.user_id = (select auth.uid())
      where m.id = target_member and m.trainer_user_id = r.user_id and r.role = 'trainer'
    );
$$;
revoke all on function private.is_admin(), private.is_assigned_trainer(uuid) from public, anon;
grant execute on function private.is_admin(), private.is_assigned_trainer(uuid) to authenticated;

-- Append-only history for application identities. No names, medical notes,
-- passwords, tokens or before/after copies of personal records are retained.
create table if not exists private.security_audit (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  entity_table text not null,
  entity_id uuid,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE'))
);
alter table private.security_audit enable row level security;
revoke all on private.security_audit from public, anon, authenticated;
revoke all on sequence private.security_audit_id_seq from public, anon, authenticated;
create index if not exists security_audit_time_idx on private.security_audit(occurred_at);
create or replace function private.record_security_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare entry jsonb;
begin
  if tg_op = 'DELETE' then entry := to_jsonb(old); else entry := to_jsonb(new); end if;
  insert into private.security_audit(actor_id, entity_table, entity_id, operation)
    values (auth.uid(), tg_table_name,
      coalesce(entry->>'id', entry->>'session_id', entry->>'member_id', entry->>'user_id')::uuid, tg_op);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.record_security_audit() from public, anon, authenticated;
do $$
declare name text;
begin
  foreach name in array array['user_roles','members','member_admin_notes','routines','memberships','payments','sessions','session_reviews'] loop
    execute format('alter table public.%I enable row level security', name);
    execute format('drop trigger if exists gns_security_audit on public.%I', name);
    execute format('create trigger gns_security_audit after insert or update or delete on public.%I for each row execute function private.record_security_audit()', name);
  end loop;
end;
$$;
commit;
