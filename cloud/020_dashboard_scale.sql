-- Additive maintenance: bounded dashboard response, existing RLS and MFA retained.
begin;
set local lock_timeout = '5s';
create index if not exists payments_membership_lookup_idx on public.payments(membership_id);
create index if not exists payments_date_lookup_idx on public.payments(paid_at);
create index if not exists sessions_date_lookup_idx on public.sessions(performed_at);
create index if not exists memberships_latest_lookup_idx on public.memberships(member_id, starts_at desc, id desc);

create or replace function public.admin_dashboard(p_page integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; today date := (now() at time zone 'America/Montevideo')::date;
begin
  if not private.is_admin() then raise exception 'Se requiere administrador con doble factor.' using errcode = '42501'; end if;
  if p_page is null or p_page < 0 or p_page > 100000 then raise exception 'Página inválida.'; end if;
  with latest as materialized (
    select distinct on (member_id) id,member_id,plan_name,ends_at,price
    from public.memberships order by member_id,starts_at desc,id desc
  ), balances as materialized (
    select l.*,greatest(0,l.price-coalesce(p.amount,0)) as balance
    from latest l left join (select membership_id,sum(amount) amount from public.payments group by membership_id) p on p.membership_id=l.id
  ), pending_page as (
    select m.id,m.first_name,m.last_name,b.plan_name,b.balance
    from balances b join public.members m on m.id=b.member_id where b.balance>0
    order by b.balance desc,m.last_name,m.id limit 25 offset p_page*25
  )
  select jsonb_build_object(
    'date',today,'page',p_page,'pageSize',25,
    'members',(select count(*) from public.members),
    'active',(select count(*) from public.members where status='Activo'),
    'joined',(select count(*) from public.members where joined_at>=date_trunc('month',today)::date and joined_at<(date_trunc('month',today)+interval '1 month')::date),
    'inactive',(select count(*) from public.members where status='Baja'),
    'income',coalesce((select sum(amount) from public.payments),0),
    'monthlyIncome',coalesce((select sum(amount) from public.payments where paid_at>=date_trunc('month',today)::date and paid_at<(date_trunc('month',today)+interval '1 month')::date),0),
    'routines',(select count(*) from public.routines),
    'sessions',(select count(*) from public.sessions where performed_at>=date_trunc('month',today)::date and performed_at<(date_trunc('month',today)+interval '1 month')::date),
    'expired',(select count(*) from latest where ends_at<today),
    'expiring',(select count(*) from latest where ends_at between today and today+10),
    'pending',coalesce((select sum(balance) from balances),0),
    'debtors',(select count(*) from balances where balance>0),
    'withoutPlan',(select count(*) from public.members)-(select count(*) from latest),
    'plans',coalesce((select jsonb_agg(x order by x.count desc,x.name) from (select plan_name name,count(*) count from latest group by plan_name) x),'[]'::jsonb),
    'pendingMembers',coalesce((select jsonb_agg(p) from pending_page p),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_dashboard(integer) from public,anon;
grant execute on function public.admin_dashboard(integer) to authenticated;
notify pgrst,'reload schema';
commit;
