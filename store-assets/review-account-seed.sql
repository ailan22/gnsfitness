-- Apply only after creating the isolated Auth user below, with auto-confirm and no email.
-- Fictional records only. No real member is changed. Re-running preserves reviewer edits.
begin;
do $$ begin
 if not exists(select 1 from auth.users where id='15781983-dd3b-4027-b30f-d6156061ddcf' and email='app-review@gnsfitness.invalid') then
  raise exception 'Expected isolated review account does not exist';
 end if;
end $$;
insert into public.user_roles(user_id,role) values('15781983-dd3b-4027-b30f-d6156061ddcf','student') on conflict(user_id) do nothing;
insert into public.members(id,user_id,first_name,last_name,email,joined_at,status,goal,trainer_name,welcome_form)
 values('70000000-0000-4000-8000-000000000001','15781983-dd3b-4027-b30f-d6156061ddcf','Lucía','Ejemplo (revisión Apple)','app-review@gnsfitness.invalid',current_date,'Activo','Programa de demostración con datos ficticios','Equipo GNS','Bienvenida') on conflict(id) do nothing;
insert into public.routines(id,member_id,name,level,days_per_week,program_rounds,block_rounds,plan)
 values('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','Programa de demostración','Inicial',2,4,2,
 '{"exercisesByDay":{"1":[{"id":"demo-squat","name":"Sentadilla","sets":"3","reps":"10","rir":"2","rest":"90 segundos","load":"","notes":"Ejemplo para revisión de la app."}],"2":[{"id":"demo-row","name":"Remo con mancuerna","sets":"3","reps":"10","rir":"2","rest":"90 segundos","load":"","notes":"Ejemplo para revisión de la app."}]}}'::jsonb) on conflict(id) do nothing;
insert into public.member_progress(member_id,measured_on,metric,value)
 values('70000000-0000-4000-8000-000000000001',current_date-14,'weight',70),('70000000-0000-4000-8000-000000000001',current_date-7,'weight',69),('70000000-0000-4000-8000-000000000001',current_date,'weight',68.5)
 on conflict(member_id,metric,measured_on) do nothing;
commit;
