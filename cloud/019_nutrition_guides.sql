begin;
-- No default grants: previously visible bundles require explicit guide selection.
alter table public.service_requests add column if not exists nutrition_guides text[] not null default '{}';
alter table public.service_requests add constraint service_requests_nutrition_guides_check check (
 nutrition_guides <@ array['food','recipes']::text[] and cardinality(nutrition_guides)<=2 and array_position(nutrition_guides,null) is null
);
create or replace function public.assign_nutrition_guides(p_member uuid,p_guides text[],p_expected text[])
returns void language plpgsql security definer set search_path='' as $$
declare current_request public.service_requests; chosen text[];
begin
 if not private.is_admin() then raise exception 'Administrador con doble factor requerido' using errcode='42501'; end if;
 if p_guides is null or p_expected is null or not(p_guides <@ array['food','recipes']::text[]) or cardinality(p_guides)>2 or array_position(p_guides,null) is not null then raise exception 'Selección inválida'; end if;
 if not exists(select 1 from public.members where id=p_member and user_id is not null) then raise exception 'Vinculá la cuenta del socio primero.'; end if;
 select * into current_request from public.service_requests where member_id=p_member and service='nutrition' for update;
 if current_request.id is null or current_request.status not in ('pending','enabled') then raise exception 'Primero el alumno debe solicitar acceso a Nutrición.'; end if;
 if current_request.nutrition_guides<>p_expected then raise exception 'La selección cambió. Actualizá antes de guardar.' using errcode='40001'; end if;
 select coalesce(array_agg(distinct g order by g),'{}') into chosen from unnest(p_guides) g;
 update public.service_requests set nutrition_guides=chosen,
 status=case when cardinality(chosen)>0 then 'enabled' else status end,
 decided_at=now(),decided_by=auth.uid() where id=current_request.id;
end; $$;
revoke all on function public.assign_nutrition_guides(uuid,text[],text[]) from public,anon;
grant execute on function public.assign_nutrition_guides(uuid,text[],text[]) to authenticated;
-- A withdrawn request must not restore previous guides on later approval.
create or replace function public.decide_service_request(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrador con segundo factor requerido'; end if;
 if p_status not in ('enabled','declined','revoked') or p_status is null then raise exception 'Estado inválido'; end if;
 update public.service_requests set status=p_status,nutrition_guides=case when p_status='enabled' then nutrition_guides else '{}'::text[] end,decided_at=now(),decided_by=auth.uid() where id=p_id;
 if not found then raise exception 'Solicitud inexistente'; end if;
end; $$;
notify pgrst,'reload schema';
commit;
