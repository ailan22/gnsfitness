-- Mejora aditiva: no borra datos. Aplicar después de 020.
begin;
set local lock_timeout='5s';
create or replace function public.create_membership_period(p_row jsonb, p_expected uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.memberships%rowtype; last_id uuid; existing jsonb; anniversary date; expected_end date;
begin
 if not private.is_admin() then raise exception 'Se requiere administrador con doble factor' using errcode='42501'; end if;
 r := jsonb_populate_record(null::public.memberships,p_row);
 if r.id is null or r.member_id is null or r.starts_at is null or r.ends_at is null or r.ends_at<r.starts_at then raise exception 'Período inválido'; end if;
 if r.months is null or r.months not in (1,3,6,12) or r.price is null or r.price<=0 then raise exception 'Duración o importe inválido'; end if;
 anniversary := (r.starts_at + make_interval(months=>r.months))::date;
 expected_end := case when extract(day from anniversary)<extract(day from r.starts_at) then anniversary else anniversary-1 end;
 if r.ends_at<>expected_end then raise exception 'El vencimiento no coincide con la duración'; end if;
 perform 1 from public.members where id=r.member_id for update;
 if not found then raise exception 'Socio no encontrado'; end if;
 select to_jsonb(m) into existing from public.memberships m where id=r.id;
 if found then
   if existing @> p_row then return r.id; end if;
   raise exception 'La solicitud ya se usó con otros datos';
 end if;
 select id into last_id from public.memberships where member_id=r.member_id order by starts_at desc,id desc limit 1;
 if last_id is distinct from p_expected then raise exception 'El plan cambió. Actualizá la ficha' using errcode='40001'; end if;
 if exists(select 1 from public.memberships where member_id=r.member_id and starts_at<=r.ends_at and ends_at>=r.starts_at) then raise exception 'El período se superpone con un plan existente'; end if;
 insert into public.memberships(id,member_id,plan_name,months,starts_at,ends_at,price,service_extras,service_details,service_config)
 values(r.id,r.member_id,r.plan_name,r.months,r.starts_at,r.ends_at,r.price,coalesce(r.service_extras,'{}'),coalesce(r.service_details,''),r.service_config);
 return r.id;
end $$;
revoke all on function public.create_membership_period(jsonb,uuid) from public,anon;
grant execute on function public.create_membership_period(jsonb,uuid) to authenticated;
create or replace function public.register_membership_payment(
 p_request_id uuid, p_member_id uuid, p_membership_id uuid,
 p_paid_at date, p_amount_cents bigint, p_method text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_existing public.payments%rowtype;
begin
 if not private.is_admin() then raise exception 'Acceso exclusivo del administrador' using errcode = '42501'; end if;
 if p_request_id is null or p_paid_at is null or p_amount_cents is null or p_amount_cents <= 0
   or p_amount_cents > 999999999999 or p_method is null or p_method not in ('Efectivo', 'Transferencia', 'Tarjeta', 'Otro') then
   raise exception 'Datos de pago no válidos';
 end if;
 -- Serializa reintentos y cobros del mismo socio. El trigger protege también
 -- las escrituras directas de clientes anteriores, bloqueando el plan.
 perform 1 from public.members where id = p_member_id for update;
 if not found then raise exception 'Socio no encontrado'; end if;
 select * into v_existing from public.payments where id = p_request_id;
 if found then
   if v_existing.member_id is distinct from p_member_id or v_existing.membership_id is distinct from p_membership_id
     or v_existing.paid_at is distinct from p_paid_at or v_existing.amount is distinct from p_amount_cents::numeric / 100
     or v_existing.method is distinct from p_method then raise exception 'La solicitud ya se usó con otros datos'; end if;
   return p_request_id;
 end if;
 perform 1 from public.memberships where id=p_membership_id and member_id=p_member_id;
 if not found then raise exception 'El plan no pertenece al socio'; end if;
 insert into public.payments(id, member_id, membership_id, paid_at, amount, method)
 values(p_request_id, p_member_id, p_membership_id, p_paid_at, p_amount_cents::numeric / 100, p_method);
 return p_request_id;
end;
$$;
revoke all on function public.register_membership_payment(uuid,uuid,uuid,date,bigint,text) from public, anon;
grant execute on function public.register_membership_payment(uuid,uuid,uuid,date,bigint,text) to authenticated;
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
    from public.memberships l left join (select membership_id,sum(amount) amount from public.payments group by membership_id) p on p.membership_id=l.id
  ), member_balances as (
    select member_id,sum(balance) as balance,count(*) filter(where balance>0) as periods from balances where balance>0 group by member_id
  ), pending_page as (
    select m.id,m.first_name,m.last_name,(b.periods::text || ' período(s) con saldo') as plan_name,b.balance
    from member_balances b join public.members m on m.id=b.member_id where b.balance>0
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
    'debtors',(select count(*) from member_balances),
    'withoutPlan',(select count(*) from public.members)-(select count(*) from latest),
    'plans',coalesce((select jsonb_agg(x order by x.count desc,x.name) from (select plan_name name,count(*) count from latest group by plan_name) x),'[]'::jsonb),
    'pendingMembers',coalesce((select jsonb_agg(p) from pending_page p),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_dashboard(integer) from public,anon;
grant execute on function public.admin_dashboard(integer) to authenticated;
notify pgrst,'reload schema';
notify pgrst, 'reload schema';
commit;
