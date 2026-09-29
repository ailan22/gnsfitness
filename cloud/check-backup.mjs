// Comprobación local previa a la futura importación. No transmite ni modifica datos.
import { readFile } from 'node:fs/promises'

const path = process.argv[2]
if (!path || process.argv.length !== 3) {
  console.error('Uso: node cloud/check-backup.mjs ruta/al/respaldo.json')
  process.exit(2)
}

const errors = []
const warnings = []
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const date = /^\d{4}-\d{2}-\d{2}$/
let data
try {
  data = JSON.parse(await readFile(path, 'utf8'))
} catch (error) {
  console.error(`No se pudo abrir el respaldo: ${error.message}`)
  process.exit(1)
}

const tables = ['members', 'routines', 'memberships', 'payments', 'sessions']
if (!data || typeof data !== 'object' || Array.isArray(data)) {
  errors.push('El respaldo debe contener un objeto JSON.')
} else {
  for (const name of tables) {
    if (!Array.isArray(data[name]) && !(name === 'sessions' && data[name] === undefined)) {
      errors.push(`Falta la lista ${name}.`)
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

const rows = Object.fromEntries(tables.map(name => [name, data[name] ?? []]))
const ids = {}
for (const name of tables) {
  ids[name] = new Set()
  for (const [index, item] of rows[name].entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${name}[${index}]: registro inválido.`)
      continue
    }
    if (typeof item.id !== 'string' || !uuid.test(item.id)) errors.push(`${name}[${index}]: ID no es UUID.`)
    else if (ids[name].has(item.id)) errors.push(`${name}[${index}]: ID repetido.`)
    else ids[name].add(item.id)
  }
}

const checkMember = (row, name, index) => {
  if (!ids.members.has(row.memberId)) errors.push(`${name}[${index}]: socio inexistente.`)
}
for (const [index, row] of rows.members.entries()) {
  if (!row || typeof row !== 'object') continue
  if (!date.test(row.joinedAt ?? '')) errors.push(`members[${index}]: fecha de alta inválida.`)
  if (row.birthDate && !date.test(row.birthDate)) errors.push(`members[${index}]: fecha de nacimiento inválida.`)
  if (!['Activo', 'Inactivo', 'Pausado', 'Baja'].includes(row.status)) errors.push(`members[${index}]: estado inválido.`)
}
const routineMember = new Map()
for (const [index, row] of rows.routines.entries()) {
  if (!row || typeof row !== 'object') continue
  checkMember(row, 'routines', index)
  routineMember.set(row.id, row.memberId)
  if (!Number.isInteger(row.daysPerWeek) || row.daysPerWeek < 1 || row.daysPerWeek > 7) errors.push(`routines[${index}]: días por semana fuera de 1–7.`)
  const rounds = row.programRounds ?? 24
  const blockRounds = row.blockRounds ?? 4
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 104 || !Number.isInteger(blockRounds) || blockRounds < 1 || blockRounds > rounds) errors.push(`routines[${index}]: semanas por programa o bloque inválidas.`)
  if (typeof row.name !== 'string' || typeof row.level !== 'string') errors.push(`routines[${index}]: nombre o nivel inválido.`)
  if (!date.test((row.createdAt ?? '').slice(0, 10))) warnings.push(`routines[${index}]: fecha de creación ausente o inválida.`)
}
const membershipMember = new Map()
for (const [index, row] of rows.memberships.entries()) {
  if (!row || typeof row !== 'object') continue
  checkMember(row, 'memberships', index)
  membershipMember.set(row.id, row.memberId)
  if (!date.test(row.startsAt ?? '') || !date.test(row.endsAt ?? '')) errors.push(`memberships[${index}]: fechas inválidas.`)
  if (!Number.isInteger(row.months) || row.months < 1) errors.push(`memberships[${index}]: meses inválidos.`)
  if (typeof row.price !== 'number' || !Number.isFinite(row.price) || row.price < 0) errors.push(`memberships[${index}]: precio inválido.`)
}
for (const [index, row] of rows.payments.entries()) {
  if (!row || typeof row !== 'object') continue
  checkMember(row, 'payments', index)
  if (membershipMember.get(row.membershipId) !== row.memberId) errors.push(`payments[${index}]: membresía inexistente o de otro socio.`)
  if (!date.test(row.paidAt ?? '')) errors.push(`payments[${index}]: fecha inválida.`)
  if (typeof row.amount !== 'number' || !Number.isFinite(row.amount) || row.amount <= 0 || !['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].includes(row.method)) errors.push(`payments[${index}]: monto o método inválido.`)
}
let orphanSessions = 0
let legacyReviews = 0
for (const [index, row] of rows.sessions.entries()) {
  if (!row || typeof row !== 'object') continue
  checkMember(row, 'sessions', index)
  if (!date.test(row.performedAt ?? '')) errors.push(`sessions[${index}]: fecha inválida.`)
  if (row.day !== null && (!Number.isInteger(row.day) || row.day < 1 || row.day > 7)) errors.push(`sessions[${index}]: día inválido.`)
  if (row.block !== undefined && (!Number.isInteger(row.block) || row.block < 1 || row.block > 104)) errors.push(`sessions[${index}]: bloque inválido.`)
  if (row.week !== undefined && (!Number.isInteger(row.week) || row.week < 1 || row.week > 104)) errors.push(`sessions[${index}]: semana inválida.`)
  if (row.routineId && routineMember.get(row.routineId) !== row.memberId) orphanSessions++
  if (row.review) legacyReviews++
}

console.log('Comprobación del respaldo (sin cargar datos a internet):')
for (const name of tables) console.log(`  ${name}: ${rows[name].length}`)
if (orphanSessions) warnings.push(`${orphanSessions} entrenamiento(s) conservan una rutina eliminada: se debe importar el nombre histórico y dejar su referencia vacía.`)
if (legacyReviews) warnings.push(`${legacyReviews} revisión(es) guardan solo el nombre del entrenador: requerirán una vinculación posterior a su cuenta.`)
for (const warning of warnings) console.log(`Aviso: ${warning}`)
for (const error of errors) console.error(`Error: ${error}`)
console.log(errors.length ? 'Resultado: corregir antes de migrar.' : 'Resultado: estructura preliminar apta para preparar la migración.')
process.exitCode = errors.length ? 1 : 0
