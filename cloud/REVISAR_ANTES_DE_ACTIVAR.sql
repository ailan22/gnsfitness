-- SOLO LECTURA. Ejecutar antes de ACTIVAR_PROTECCIONES.sql.
select current_database() as base;
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename in ('members','member_admin_notes','user_roles','routines','memberships','payments','sessions','session_reviews') order by tablename;
select tablename, policyname, roles, cmd, qual, with_check from pg_policies
where schemaname='public' and tablename in ('members','member_admin_notes','user_roles','routines','memberships','payments','sessions','session_reviews') order by tablename, policyname;
select p.oid::regprocedure::text as funcion, p.prosecdef as security_definer, p.proconfig as configuracion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.proname in ('student_register_next_day','is_admin','is_assigned_trainer','is_member_self');
-- Contar anomalías existentes sin mostrar información personal.
select count(*) as planes_con_cobros_superiores_al_precio from public.memberships m
where (select coalesce(sum(p.amount),0) from public.payments p where p.membership_id=m.id) > m.price;
