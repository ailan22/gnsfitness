// Genera un SQL transaccional desde un respaldo local. No se conecta a Supabase.
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const [input, output] = process.argv.slice(2)
if (!input || process.argv.length > 4) {
  console.error('Uso: node cloud/prepare-import.mjs RESPALDO.json [SALIDA.sql]')
  process.exit(2)
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const date = /^\d{4}-\d{2}-\d{2}$/
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const tables = ['members', 'routines', 'memberships', 'payments', 'sessions']
let backup
try { backup = JSON.parse(await readFile(input, 'utf8')) }
catch (error) { console.error(`No se pudo leer el respaldo: ${error.message}`); process.exit(1) }
const errors = []
if (!object(backup)) errors.push('El respaldo debe ser un objeto JSON.')
for (const name of tables) if (!Array.isArray(backup?.[name]) && !(name === 'sessions' && backup?.[name] === undefined)) errors.push(`Falta ${name}.`)
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
backup.sessions ??= []
const ids = {}
for (const name of tables) {
  ids[name] = new Set()
  for (const [i, row] of backup[name].entries()) {
    if (!object(row) || !uuid.test(row.id ?? '') || ids[name].has(row.id)) errors.push(`${name}[${i}]: ID inválido o repetido.`)
    else ids[name].add(row.id)
  }
}
const field = (row, key) => typeof row[key] === 'string'
const related = (row, name, i) => { if (!ids.members.has(row.memberId)) errors.push(`${name}[${i}]: socio inexistente.`) }
backup.members.forEach((m, i) => {
  if (!object(m)) return
  if (!field(m, 'firstName') || !field(m, 'lastName') || !date.test(m.joinedAt ?? '') ||
      (m.birthDate && !date.test(m.birthDate)) || !['Activo', 'Inactivo', 'Pausado', 'Baja'].includes(m.status)) errors.push(`members[${i}]: datos obligatorios inválidos.`)
})
const routineOwners = new Map()
backup.routines.forEach((r, i) => {
  if (!object(r)) return
  related(r, 'routines', i)
  routineOwners.set(r.id, r.memberId)
  const weeks = r.programRounds ?? 24, block = r.blockRounds ?? 4
  if (!field(r, 'name') || !field(r, 'level') || !field(r, 'goal') || !object(r.exercisesByDay) ||
      !Number.isInteger(r.daysPerWeek) || r.daysPerWeek < 1 || r.daysPerWeek > 7 ||
      !Number.isInteger(weeks) || weeks < 1 || weeks > 104 ||
      !Number.isInteger(block) || block < 1 || block > weeks ||
      (r.createdAt && Number.isNaN(Date.parse(r.createdAt)))) errors.push(`routines[${i}]: datos de planificación inválidos.`)
})
const membershipOwners = new Map()
backup.memberships.forEach((m, i) => {
  if (!object(m)) return
  related(m, 'memberships', i)
  membershipOwners.set(m.id, m.memberId)
  if (!field(m, 'planName') || !date.test(m.startsAt ?? '') || !date.test(m.endsAt ?? '') ||
      !Number.isInteger(m.months) || m.months < 1 || !Number.isFinite(m.price) || m.price < 0) errors.push(`memberships[${i}]: datos inválidos.`)
})
backup.payments.forEach((p, i) => {
  if (!object(p)) return
  related(p, 'payments', i)
  if (membershipOwners.get(p.membershipId) !== p.memberId || !date.test(p.paidAt ?? '') ||
      !Number.isFinite(p.amount) || p.amount <= 0 || !['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].includes(p.method)) errors.push(`payments[${i}]: datos inválidos.`)
})
backup.sessions.forEach((s, i) => {
  if (!object(s)) return
  related(s, 'sessions', i)
  if (!date.test(s.performedAt ?? '') || !field(s, 'routineName') || !field(s, 'notes') ||
      (s.day !== null && (!Number.isInteger(s.day) || s.day < 1 || s.day > 7)) ||
      (s.block !== undefined && (!Number.isInteger(s.block) || s.block < 1 || s.block > 104)) ||
      (s.week !== undefined && (!Number.isInteger(s.week) || s.week < 1 || s.week > 104)) ||
      (s.results !== undefined && !Array.isArray(s.results)) ||
      (s.review && (!object(s.review) || !field(s.review, 'trainer') || !field(s.review, 'notes') || !date.test(s.review.reviewedAt ?? '')))) errors.push(`sessions[${i}]: datos inválidos.`)
})
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }

const destination = resolve(output ?? resolve(input).replace(/\.json$/i, '') + '-import.sql')
if (destination === resolve(input)) { console.error('La salida no puede sobrescribir el respaldo.'); process.exit(1) }
const serialized = JSON.stringify(backup)
let tag = `gns_${randomUUID().replaceAll('-', '')}`
while (serialized.includes(`$${tag}$`)) tag = `gns_${randomUUID().replaceAll('-', '')}`
const sql = `-- GNS Training: importación de respaldo local, generada automáticamente.
-- Revisar el proyecto de Supabase antes de ejecutar; nunca compartir este SQL.
-- No borra ni sobrescribe registros. Si encuentra un ID existente, aborta todo.
begin;
do $gns_import$
declare
  payload jsonb := $${tag}$${serialized}$${tag}$::jsonb;
  item jsonb;
  existing_count integer;
begin
  if exists (select 1 from public.members where id in (select (value->>'id')::uuid from jsonb_array_elements(payload->'members')))
    or exists (select 1 from public.routines where id in (select (value->>'id')::uuid from jsonb_array_elements(payload->'routines')))
    or exists (select 1 from public.memberships where id in (select (value->>'id')::uuid from jsonb_array_elements(payload->'memberships')))
    or exists (select 1 from public.payments where id in (select (value->>'id')::uuid from jsonb_array_elements(payload->'payments')))
    or exists (select 1 from public.sessions where id in (select (value->>'id')::uuid from jsonb_array_elements(payload->'sessions')))
  then
    raise exception 'La importación se canceló: hay IDs del respaldo que ya existen. No se cambió ningún registro.';
  end if;

  for item in select value from jsonb_array_elements(payload->'members') loop
    insert into public.members (id, first_name, last_name, phone, email, birth_date, joined_at, status,
      emergency_contact_name, emergency_contact_phone, goal, limitations, trainer_name)
    values ((item->>'id')::uuid, item->>'firstName', item->>'lastName', coalesce(item->>'phone',''),
      coalesce(item->>'email',''), nullif(item->>'birthDate','')::date, (item->>'joinedAt')::date,
      item->>'status', coalesce(item->>'emergencyContactName',''), coalesce(item->>'emergencyContactPhone',''),
      coalesce(item->>'goal',''), coalesce(item->>'limitations',''), coalesce(item->>'trainer',''));
    insert into public.member_admin_notes(member_id, notes)
    values ((item->>'id')::uuid, coalesce(item->>'notes',''));
  end loop;

  for item in select value from jsonb_array_elements(payload->'routines') loop
    insert into public.routines (id, member_id, name, goal, level, days_per_week, program_rounds,
      block_rounds, plan, created_at)
    values ((item->>'id')::uuid, (item->>'memberId')::uuid, item->>'name', item->>'goal', item->>'level',
      (item->>'daysPerWeek')::smallint, coalesce((item->>'programRounds')::smallint,24),
      coalesce((item->>'blockRounds')::smallint,4),
      jsonb_build_object('exercisesByDay', item->'exercisesByDay',
        'blockExercises', coalesce(item->'blockExercises','{}'::jsonb),
        'weekExercises', coalesce(item->'weekExercises','{}'::jsonb),
        'blockDetails', coalesce(item->'blockDetails','{}'::jsonb),
        'sessionGuidance', coalesce(item->'sessionGuidance','{}'::jsonb),
        'sessionComponents', coalesce(item->'sessionComponents','{}'::jsonb)),
      coalesce(nullif(item->>'createdAt','')::timestamptz, now()));
  end loop;

  for item in select value from jsonb_array_elements(payload->'memberships') loop
    insert into public.memberships (id, member_id, plan_name, months, starts_at, ends_at, price)
    values ((item->>'id')::uuid, (item->>'memberId')::uuid, item->>'planName', (item->>'months')::smallint,
      (item->>'startsAt')::date, (item->>'endsAt')::date, (item->>'price')::numeric);
  end loop;
  for item in select value from jsonb_array_elements(payload->'payments') loop
    insert into public.payments (id, member_id, membership_id, paid_at, amount, method)
    values ((item->>'id')::uuid, (item->>'memberId')::uuid, (item->>'membershipId')::uuid,
      (item->>'paidAt')::date, (item->>'amount')::numeric, item->>'method');
  end loop;

  for item in select value from jsonb_array_elements(payload->'sessions') loop
    insert into public.sessions (id, member_id, performed_at, routine_id, routine_name, day, block, week, notes, results)
    values ((item->>'id')::uuid, (item->>'memberId')::uuid, (item->>'performedAt')::date,
      case when exists (select 1 from public.routines r where r.id = nullif(item->>'routineId','')::uuid
        and r.member_id = (item->>'memberId')::uuid) then (item->>'routineId')::uuid else null end,
      item->>'routineName', (item->>'day')::smallint, (item->>'block')::smallint,
      (item->>'week')::smallint, item->>'notes', coalesce(item->'results','[]'::jsonb));
    if item ? 'review' and item->'review' <> 'null'::jsonb then
      insert into public.session_reviews (session_id, member_id, trainer_name, notes, reviewed_at)
      values ((item->>'id')::uuid, (item->>'memberId')::uuid, item->'review'->>'trainer',
        item->'review'->>'notes', (item->'review'->>'reviewedAt')::date);
    end if;
  end loop;

  -- Los IDs de la misma importación deben estar todos presentes antes de confirmar la transacción.
  select count(*) into existing_count from public.members
    where id in (select (value->>'id')::uuid from jsonb_array_elements(payload->'members'));
  if existing_count <> jsonb_array_length(payload->'members') then raise exception 'Falló la verificación de socios.'; end if;
  select count(*) into existing_count from public.routines
    where id in (select (value->>'id')::uuid from jsonb_array_elements(payload->'routines'));
  if existing_count <> jsonb_array_length(payload->'routines') then raise exception 'Falló la verificación de rutinas.'; end if;
  select count(*) into existing_count from public.sessions
    where id in (select (value->>'id')::uuid from jsonb_array_elements(payload->'sessions'));
  if existing_count <> jsonb_array_length(payload->'sessions') then raise exception 'Falló la verificación de entrenamientos.'; end if;
end
$gns_import$;
commit;
`
await writeFile(destination, sql, { flag: 'wx', mode: 0o600 }).catch(error => {
  console.error(`No se pudo generar el SQL (${error.message}). Conservá el respaldo original.`)
  process.exit(1)
})
console.log(`Preparado: ${destination}`)
console.log('Sin cambios en Supabase. Revisá el proyecto de prueba antes de ejecutar este archivo en SQL Editor.')
for (const name of tables) console.log(`${name}: ${backup[name].length}`)
console.log(`Revisiones: ${backup.sessions.filter(row => row.review).length}`)
