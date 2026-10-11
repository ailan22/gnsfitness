begin;
set local lock_timeout='5s';
alter table public.gym_expenses add column bps_breakdown jsonb;
create function private.validate_bps_breakdown() returns trigger language plpgsql set search_path='' as $$
declare line jsonb; total numeric:=0; labels text[]:=array[]::text[];
begin
 if new.bps_breakdown is null then return new; end if;
 if new.category not in ('BPS','BPS y aportes') or jsonb_typeof(new.bps_breakdown) is distinct from 'object' or
 jsonb_typeof(new.bps_breakdown->'lines') is distinct from 'array' or
 coalesce(new.bps_breakdown->>'period','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or length(coalesce(new.bps_breakdown->>'reference',''))>80 then raise exception 'Desglose BPS inválido'; end if;
 if jsonb_array_length(new.bps_breakdown->'lines') not between 1 and 50 then raise exception 'Desglose BPS vacío o excesivo'; end if;
 for line in select value from jsonb_array_elements(new.bps_breakdown->'lines') loop
  if jsonb_typeof(line) is distinct from 'object' or length(trim(coalesce(line->>'label',''))) not between 1 and 120 or
    jsonb_typeof(line->'amount_cents') is distinct from 'number' or coalesce(line->>'amount_cents','') !~ '^-?[0-9]+$' then raise exception 'Concepto BPS inválido'; end if;
  if line->>'label'=any(labels) then raise exception 'Concepto BPS duplicado'; end if;
  labels:=array_append(labels,line->>'label');
  if abs((line->>'amount_cents')::numeric)>100000000000 or (line->>'amount_cents')::numeric=0 or
   ((line->>'amount_cents')::numeric<0 and line->>'label'<>'Créditos / bonificaciones') or
   ((line->>'amount_cents')::numeric>0 and line->>'label'='Créditos / bonificaciones') then raise exception 'Importe BPS inválido'; end if;
  total:=total+(line->>'amount_cents')::numeric;
 end loop;
 if total<>new.amount_cents then raise exception 'El total BPS no coincide con el desglose'; end if;
 return new;
end; $$;
create trigger validate_bps_breakdown before insert or update on public.gym_expenses for each row execute function private.validate_bps_breakdown();
create or replace function public.save_gym_expense(p_id uuid,p_expected_version integer,p_data jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare existing public.gym_expenses; saved public.gym_expenses;
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 if p_id is null or p_expected_version is null or p_expected_version<0 then raise exception 'Registro inválido'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,26));
 select * into existing from public.gym_expenses where id=p_id for update;
 p_data:=p_data||jsonb_build_object('bps_breakdown',case when p_data ? 'bps_breakdown' then p_data->'bps_breakdown' else existing.bps_breakdown end);
 if (existing.id is null and p_expected_version<>0) or (existing.id is not null and p_expected_version<>existing.version) then
  -- A retry of the same request is harmless; different data requires a refresh.
  if existing.id is not null and existing.version=p_expected_version+1 and
    (to_jsonb(existing)-array['id','version','created_at','updated_at','updated_by'])=p_data then return existing.version; end if;
  raise exception 'El gasto cambió. Actualizá la lista antes de editar.' using errcode='40001';
 end if;
 if (p_data->>'paid_date')::date > (now() at time zone 'America/Montevideo')::date then raise exception 'La fecha de pago no puede ser futura'; end if;
 insert into public.gym_expenses(id,category,concept,expense_type,amount_cents,due_date,status,paid_date,notes,updated_by,bps_breakdown)
 values(p_id,p_data->>'category',trim(p_data->>'concept'),p_data->>'expense_type',(p_data->>'amount_cents')::bigint,(p_data->>'due_date')::date,p_data->>'status',(p_data->>'paid_date')::date,coalesce(p_data->>'notes',''),auth.uid(),nullif(p_data->'bps_breakdown','null'::jsonb))
 on conflict(id) do update set category=excluded.category,concept=excluded.concept,expense_type=excluded.expense_type,amount_cents=excluded.amount_cents,due_date=excluded.due_date,status=excluded.status,paid_date=excluded.paid_date,notes=excluded.notes,bps_breakdown=excluded.bps_breakdown,version=public.gym_expenses.version+1,updated_at=now(),updated_by=auth.uid()
 returning * into saved;
 insert into public.gym_expense_history(expense_id,version,recorded_by,snapshot) values(saved.id,saved.version,auth.uid(),to_jsonb(saved));
 return saved.version;
end; $$;
revoke all on function public.save_gym_expense(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_gym_expense(uuid,integer,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
