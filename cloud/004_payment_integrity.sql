-- Aplicar después de 003_welcome.sql. No modifica ni elimina pagos existentes.
-- Ejecutar como una unidad: si alguna comprobación falla, se revierte todo.
begin;
create or replace function private.check_payment_balance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_price numeric; v_paid numeric;
begin
  if TG_OP = 'UPDATE' and (new.id <> old.id or new.member_id <> old.member_id or new.membership_id <> old.membership_id) then
    raise exception 'No se puede trasladar un pago a otro socio o plan';
  end if;
  select price into v_price from public.memberships
    where id = new.membership_id and member_id = new.member_id for update;
  if not found then raise exception 'Plan no encontrado'; end if;
  if new.paid_at > (now() at time zone 'America/Montevideo')::date then raise exception 'Fecha de pago futura'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments
    where membership_id = new.membership_id and id <> new.id;
  if v_paid + new.amount > v_price then raise exception 'El pago supera el saldo pendiente'; end if;
  return new;
end;
$$;
revoke all on function private.check_payment_balance() from public, anon, authenticated;
drop trigger if exists check_payment_balance on public.payments;
create trigger check_payment_balance before insert or update on public.payments
for each row execute function private.check_payment_balance();

create or replace function private.check_membership_price()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.price <> old.price and new.price < (select coalesce(sum(amount), 0) from public.payments where membership_id = new.id) then
    raise exception 'El precio no puede ser menor que lo cobrado';
  end if;
  return new;
end;
$$;
revoke all on function private.check_membership_price() from public, anon, authenticated;
drop trigger if exists check_membership_price on public.memberships;
create trigger check_membership_price before update on public.memberships
for each row execute function private.check_membership_price();

create or replace function public.register_payment(
 p_request_id uuid, p_member_id uuid, p_membership_id uuid,
 p_paid_at date, p_amount_cents bigint, p_method text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_existing public.payments%rowtype; v_current uuid;
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
 select id into v_current from public.memberships where member_id = p_member_id order by starts_at desc, id desc limit 1;
 if v_current is distinct from p_membership_id then raise exception 'El plan cambió. Actualizá la ficha'; end if;
 insert into public.payments(id, member_id, membership_id, paid_at, amount, method)
 values(p_request_id, p_member_id, p_membership_id, p_paid_at, p_amount_cents::numeric / 100, p_method);
 return p_request_id;
end;
$$;
revoke all on function public.register_payment(uuid,uuid,uuid,date,bigint,text) from public, anon;
grant execute on function public.register_payment(uuid,uuid,uuid,date,bigint,text) to authenticated;
commit;
