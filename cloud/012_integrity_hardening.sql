-- Additive checks for future writes; historical rows are not rewritten.
begin;
create or replace function private.validate_membership_services() returns trigger
language plpgsql set search_path = '' as $$
declare config jsonb := new.service_config; value jsonb; session_date date; seen text[] := '{}';
begin
 if config is null then return new; end if;
 if (tg_op = 'UPDATE') and new.service_config is not distinct from old.service_config
   and new.starts_at=old.starts_at and new.ends_at=old.ends_at and new.months=old.months
   and new.service_extras=old.service_extras then return new; end if;
 if jsonb_typeof(config) is distinct from 'object' or config->>'version' is distinct from '1'
   or jsonb_typeof(config->'physioDates') is distinct from 'array' then raise exception 'Configuración de servicios inválida'; end if;
 if coalesce(config->>'nutritionMonthly','') !~ '^\d+(\.\d{1,2})?$'
   or coalesce(config->>'physioSessionPrice','') !~ '^\d+(\.\d{1,2})?$'
   or coalesce(config->>'nutritionMonths','') !~ '^\d+$' then raise exception 'Importes de servicios inválidos'; end if;
 if (config->>'nutritionMonthly')::numeric > 9999999 or (config->>'physioSessionPrice')::numeric > 9999999
   or (config->>'nutritionMonths')::numeric <> (case when 'Nutrición'=any(new.service_extras) then new.months else 0 end) then
   raise exception 'Duración o precio de servicios inválido'; end if;
 if jsonb_array_length(config->'physioDates') > 366 then raise exception 'Demasiadas sesiones'; end if;
 for value in select * from jsonb_array_elements(config->'physioDates') loop
   if jsonb_typeof(value) <> 'string' or (value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha de sesión inválida'; end if;
   session_date := (value #>> '{}')::date;
   if session_date < new.starts_at or session_date > new.ends_at or (value #>> '{}')=any(seen) then raise exception 'Sesión repetida o fuera del plan'; end if;
   seen := array_append(seen,value #>> '{}');
 end loop;
 if ('Kinesiología'=any(new.service_extras)) <> (cardinality(seen)>0) then raise exception 'Las sesiones no coinciden con el complemento contratado'; end if;
 return new;
end; $$;
revoke all on function private.validate_membership_services() from public,anon,authenticated;
drop trigger if exists validate_membership_services on public.memberships;
create trigger validate_membership_services before insert or update on public.memberships for each row execute function private.validate_membership_services();
drop trigger if exists gns_security_audit on public.privacy_requests;
create trigger gns_security_audit after insert or update or delete on public.privacy_requests for each row execute function private.record_security_audit();
notify pgrst, 'reload schema';
commit;
