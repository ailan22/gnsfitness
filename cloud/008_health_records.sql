-- Private-by-policy clinical records. Requires migrations 001–007.
-- Additive: no changes to existing member records or MFA enrollment.
begin;
create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  kind text not null check (kind in ('training_intake','physio_assessment','physio_followup')),
  occurred_on date not null,
  professional text not null check (length(btrim(professional)) between 1 and 160),
  registration text not null default '' check (length(registration) <= 100),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  episode_id uuid references public.health_records(id) on delete restrict,
  correction_of uuid unique references public.health_records(id) on delete restrict,
  correction_reason text not null default '' check (length(correction_reason) <= 1000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.health_records enable row level security;
revoke all on public.health_records from public, anon, authenticated;
grant select, insert on public.health_records to authenticated;
drop policy if exists health_admin_read on public.health_records;
create policy health_admin_read on public.health_records for select to authenticated using ((select private.is_admin()));
drop policy if exists health_admin_insert on public.health_records;
create policy health_admin_insert on public.health_records for insert to authenticated
  with check ((select private.is_admin()) and created_by = (select auth.uid()));
create index if not exists health_records_member_time on public.health_records(member_id, occurred_on desc, created_at desc, id);
create index if not exists health_records_episode on public.health_records(episode_id);

create or replace function private.validate_health_record() returns trigger
language plpgsql set search_path = '' as $$
declare allowed text[]; required text[]; k text; v jsonb; source public.health_records;
begin
  -- Force server provenance, including when clients send a forged timestamp.
  new.created_at := now();
  new.created_by := auth.uid();
  if new.occurred_on > (now() at time zone 'America/Montevideo')::date or new.occurred_on < date '1900-01-01' then
    raise exception 'Fecha de atención inválida';
  end if;
  if new.kind = 'training_intake' then
    allowed := array['goals','activity','availability','history','medication','injuries','symptoms','symptom_details','guidance','context','consent','consent_notes','decision','plan'];
    required := array['goals','activity','symptoms','consent','decision','plan'];
  elsif new.kind = 'physio_assessment' then
    allowed := array['reason','region','onset','pain_rest','pain_movement','factors','function','history','medication','referral','alerts','alert_details','examination','assessment','goals','consent','consent_notes','plan','review_date'];
    required := array['reason','region','onset','function','alerts','examination','assessment','goals','consent','plan'];
  else
    allowed := array['subjective','pain_rest','pain_movement','objective','intervention','response','status','plan','consent_notes','review_date'];
    required := array['subjective','objective','intervention','response','status','plan'];
  end if;
  if jsonb_typeof(new.payload) is distinct from 'object' or octet_length(new.payload::text) > 100000 then raise exception 'Contenido inválido'; end if;
  for k,v in select * from jsonb_each(new.payload) loop
    if not (k = any(allowed)) or jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 2000 then raise exception 'Campo inválido: %', k; end if;
  end loop;
  foreach k in array required loop
    if length(btrim(coalesce(new.payload->>k,''))) = 0 then raise exception 'Campo obligatorio: %', k; end if;
  end loop;
  foreach k in array array['pain_rest','pain_movement'] loop
    if coalesce(new.payload->>k,'') <> '' and (new.payload->>k) !~ '^([0-9]|10)$' then raise exception 'Dolor fuera de escala'; end if;
  end loop;
  if coalesce(new.payload->>'review_date','') <> '' then
    if (new.payload->>'review_date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha inválida'; end if;
    perform (new.payload->>'review_date')::date;
  end if;
  if new.kind <> 'physio_followup' and not (new.payload->>'consent' = any(array['Verbal registrado','Escrito registrado','Pendiente / no otorgado'])) then raise exception 'Consentimiento inválido'; end if;
  if new.kind = 'training_intake' then
    if not (new.payload->>'symptoms' = any(array['Sin síntomas referidos','Síntomas referidos','Pendiente de revisión'])) or
      not (new.payload->>'decision' = any(array['Pendiente de valoración','Plan adaptado acordado','Consulta de salud antes de avanzar'])) then raise exception 'Opción inválida'; end if;
    if new.payload->>'symptoms' = 'Síntomas referidos' and length(btrim(coalesce(new.payload->>'symptom_details',''))) = 0 then raise exception 'Detallar síntomas'; end if;
  elsif new.kind = 'physio_assessment' then
    if not (new.payload->>'alerts' = any(array['No identificadas en esta evaluación','Requiere derivación','Evaluación pendiente'])) then raise exception 'Opción inválida'; end if;
    if new.payload->>'alerts' = 'Requiere derivación' and length(btrim(coalesce(new.payload->>'alert_details',''))) = 0 then raise exception 'Detallar derivación'; end if;
  else
    if not (new.payload->>'status' = any(array['En tratamiento','Reevaluación','Alta','Derivación','Pausa'])) then raise exception 'Opción inválida'; end if;
  end if;
  if new.kind = 'physio_followup' then
    select * into source from public.health_records where id = new.episode_id;
    if not found or source.member_id <> new.member_id or source.kind <> 'physio_assessment' or source.occurred_on > new.occurred_on then raise exception 'Evaluación inicial inválida'; end if;
  elsif new.episode_id is not null then raise exception 'Vínculo de evaluación inválido';
  end if;
  if new.correction_of is not null then
    select * into source from public.health_records where id = new.correction_of;
    if not found or source.member_id <> new.member_id or source.kind <> new.kind or source.episode_id is distinct from new.episode_id or length(btrim(new.correction_reason)) = 0 then raise exception 'Rectificación inválida'; end if;
  elsif new.correction_reason <> '' then raise exception 'Rectificación sin original';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_health_record() from public, anon, authenticated;
drop trigger if exists validate_health_record on public.health_records;
create trigger validate_health_record before insert on public.health_records for each row execute function private.validate_health_record();
drop trigger if exists gns_security_audit on public.health_records;
create trigger gns_security_audit after insert on public.health_records for each row execute function private.record_security_audit();
commit;
