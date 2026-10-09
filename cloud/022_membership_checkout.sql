begin;
set local lock_timeout='5s';
-- Plan and receipt are committed together. A failed payment rolls back the plan.
create or replace function public.checkout_membership(p_row jsonb,p_expected uuid,p_paid_at date,p_amount_cents bigint,p_method text)
returns uuid language plpgsql security definer set search_path='' as $$
declare period_id uuid;
begin
 if not private.is_admin() then raise exception 'Se requiere administrador con doble factor' using errcode='42501'; end if;
 if p_paid_at is null or p_paid_at>(now() at time zone 'America/Montevideo')::date then raise exception 'Fecha de pago inválida'; end if;
 period_id:=public.create_membership_period(p_row,p_expected);
 perform public.register_membership_payment(period_id,(p_row->>'member_id')::uuid,period_id,p_paid_at,p_amount_cents,p_method);
 return period_id;
end $$;
revoke all on function public.checkout_membership(jsonb,uuid,date,bigint,text) from public,anon;
grant execute on function public.checkout_membership(jsonb,uuid,date,bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
