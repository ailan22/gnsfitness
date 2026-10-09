begin;
set local lock_timeout = '5s';
create or replace function public.delete_student_account(p_member_id uuid, p_expected_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target uuid; target_role text;
begin
  if not private.is_admin() then raise exception 'Se requiere administrador con doble factor' using errcode='42501'; end if;
  select user_id into target from public.members where id=p_member_id for update;
  if not found then raise exception 'No existe la ficha'; end if;
  if target is null then return false; end if;
  if target is distinct from p_expected_user_id then raise exception 'La cuenta cambió; actualizá la ficha'; end if;
  if target = auth.uid() then raise exception 'No se puede eliminar la propia cuenta administrativa'; end if;
  select role into target_role from public.user_roles where user_id=target for update;
  if target_role is distinct from 'student' then raise exception 'Solo se pueden eliminar cuentas de alumnos'; end if;
  update public.members set status='Baja', user_id=null where id=p_member_id;
  delete from auth.users where id=target;
  insert into private.security_audit(actor_id,entity_table,entity_id,operation)
    values(auth.uid(),'student_account',target,'DELETE');
  return true;
end $$;
revoke all on function public.delete_student_account(uuid,uuid) from public,anon;
grant execute on function public.delete_student_account(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
