-- Only AFTER web AND native clients use staff_register_session_checked.
-- Students already use a SECURITY DEFINER RPC and are not affected.
begin;
do $$ begin
 if to_regprocedure('public.staff_register_session_checked(jsonb,boolean,uuid)') is null then
   raise exception 'Instalar primero 017_staff_training.sql';
 end if;
end $$;
revoke insert on public.sessions from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
