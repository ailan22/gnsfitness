export type Exercise = {
  id: string
  name: string
  sets: string
  reps: string
  load: string
  rir: string
  rest: string
  tempo: string
  notes: string
}

export type SessionComponent = { id: string; title: string; details: string }

export type Member = {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  birthDate: string
  joinedAt: string
  status: 'Activo' | 'Inactivo' | 'Pausado' | 'Baja'
  notes: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  goal?: string
  limitations?: string
  trainer?: string
}

export type Routine = {
  id: string
  memberId: string
  name: string
  goal: string
  level: string
  daysPerWeek: number
  programRounds?: number
  blockRounds?: number
  exercisesByDay: Record<number, Exercise[]>
  blockExercises?: Record<number, Record<number, Exercise[]>>
  weekExercises?: Record<number, Record<number, Record<number, Exercise[]>>>
  blockDetails?: Record<number, { name: string; warmup: string; objective: string }>
  sessionGuidance?: Record<number, Record<number, Record<number, string>>>
  sessionComponents?: Record<number, Record<number, Record<number, SessionComponent[]>>>
  createdAt: string
}

export type Membership = {
  id: string
  memberId: string
  planName: string
  months: number
  startsAt: string
  endsAt: string
  price: number
}

export type Payment = {
  id: string
  memberId: string
  membershipId: string
  paidAt: string
  amount: number
  method: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro'
}

export type SessionExerciseResult = {
  comment?: string
  exerciseId: string
  name: string
  sets: string
  reps: string
  load: string
  rir: string
}

export type TrainingSession = {
  id: string
  memberId: string
  performedAt: string
  routineId?: string
  routineName: string
  day: number | null
  block?: number
  week?: number
  notes: string
  results?: SessionExerciseResult[]
  review?: { trainer: string; notes: string; reviewedAt: string }
}

export type Data = { members: Member[]; routines: Routine[]; memberships: Membership[]; payments: Payment[]; sessions: TrainingSession[] }

export function validateBackup(value: unknown): Data | null {
  if (!isObject(value) || !Array.isArray(value.members) || !Array.isArray(value.routines) ||
      !Array.isArray(value.memberships) || !Array.isArray(value.payments)) return null
  const { members, routines, memberships, payments } = value
  const sessions = value.sessions === undefined ? [] : value.sessions
  const unique = (items: Record<string, unknown>[]) => new Set(items.map(item => item.id)).size === items.length
  if (!Array.isArray(sessions) || !members.every(isObject) || !routines.every(isObject) || !memberships.every(isObject) || !payments.every(isObject) || !sessions.every(isObject)) return null
  if (![members, routines, memberships, payments, sessions].every(unique)) return null
  if (!members.every(m => typeof m.id === 'string' && typeof m.firstName === 'string' &&
      typeof m.lastName === 'string' && typeof m.joinedAt === 'string' &&
      ['Activo', 'Inactivo', 'Pausado', 'Baja'].includes(String(m.status)))) return null
  const memberIds = new Set(members.map(m => m.id))
  if (!routines.every(r => typeof r.id === 'string' && memberIds.has(r.memberId) &&
      typeof r.name === 'string' && Number.isInteger(r.daysPerWeek) &&
      Number(r.daysPerWeek) >= 1 && Number(r.daysPerWeek) <= 7 && isObject(r.exercisesByDay) &&
      (r.programRounds === undefined || (Number.isInteger(r.programRounds) && Number(r.programRounds) >= 1 && Number(r.programRounds) <= 104)) &&
      (r.blockRounds === undefined || (Number.isInteger(r.blockRounds) && Number(r.blockRounds) >= 1 && Number(r.blockRounds) <= (r.programRounds === undefined ? 24 : Number(r.programRounds)))) &&
      (r.blockExercises === undefined || (isObject(r.blockExercises) && Object.entries(r.blockExercises).every(([block, days]) =>
        Number.isInteger(Number(block)) && Number(block) >= 2 && Number(block) <= Math.ceil(Number(r.programRounds ?? 24) / Number(r.blockRounds ?? 4)) &&
        isObject(days) && Object.values(days).every(items => Array.isArray(items) && items.every(ex => isObject(ex) && typeof ex.id === 'string' && typeof ex.name === 'string'))))) &&
      (r.weekExercises === undefined || (isObject(r.weekExercises) && Object.entries(r.weekExercises).every(([block, weeks]) =>
        Number.isInteger(Number(block)) && Number(block) >= 1 && Number(block) <= Math.ceil(Number(r.programRounds ?? 24) / Number(r.blockRounds ?? 4)) &&
        isObject(weeks) && Object.entries(weeks).every(([week, days]) =>
          Number.isInteger(Number(week)) && Number(week) >= 2 && Number(week) <= Math.min(Number(r.blockRounds ?? 4), Number(r.programRounds ?? 24) - (Number(block) - 1) * Number(r.blockRounds ?? 4)) &&
          isObject(days) && Object.values(days).every(items => Array.isArray(items) && items.every(ex => isObject(ex) && typeof ex.id === 'string' && typeof ex.name === 'string')))))) &&
      (r.blockDetails === undefined || (isObject(r.blockDetails) && Object.entries(r.blockDetails).every(([block, details]) =>
        Number.isInteger(Number(block)) && Number(block) >= 1 && Number(block) <= Math.ceil(Number(r.programRounds ?? 24) / Number(r.blockRounds ?? 4)) &&
        isObject(details) && typeof details.name === 'string' && typeof details.warmup === 'string' && typeof details.objective === 'string'))) &&
      (r.sessionGuidance === undefined || (isObject(r.sessionGuidance) && Object.entries(r.sessionGuidance).every(([block, weeks]) =>
        Number.isInteger(Number(block)) && Number(block) >= 1 && Number(block) <= Math.ceil(Number(r.programRounds ?? 24) / Number(r.blockRounds ?? 4)) &&
        isObject(weeks) && Object.entries(weeks).every(([week, days]) =>
          Number.isInteger(Number(week)) && Number(week) >= 1 && Number(week) <= Math.min(Number(r.blockRounds ?? 4), Number(r.programRounds ?? 24) - (Number(block) - 1) * Number(r.blockRounds ?? 4)) &&
          isObject(days) && Object.entries(days).every(([day, note]) =>
            Number.isInteger(Number(day)) && Number(day) >= 1 && Number(day) <= Number(r.daysPerWeek) &&
            typeof note === 'string' && note.length <= 4000))))) &&
      (r.sessionComponents === undefined || (isObject(r.sessionComponents) && Object.entries(r.sessionComponents).every(([block, weeks]) =>
        Number.isInteger(Number(block)) && Number(block) >= 1 && Number(block) <= Math.ceil(Number(r.programRounds ?? 24) / Number(r.blockRounds ?? 4)) &&
        isObject(weeks) && Object.entries(weeks).every(([week, days]) =>
          Number.isInteger(Number(week)) && Number(week) >= 1 && Number(week) <= Math.min(Number(r.blockRounds ?? 4), Number(r.programRounds ?? 24) - (Number(block) - 1) * Number(r.blockRounds ?? 4)) &&
          isObject(days) && Object.entries(days).every(([day, components]) =>
            Number.isInteger(Number(day)) && Number(day) >= 1 && Number(day) <= Number(r.daysPerWeek) &&
            Array.isArray(components) && components.every(component => isObject(component) &&
              typeof component.id === 'string' && typeof component.title === 'string' && component.title.length <= 120 &&
              typeof component.details === 'string' && component.details.length <= 4000)))))) &&
      Object.values(r.exercisesByDay).every(exercises => Array.isArray(exercises) &&
        exercises.every(ex => isObject(ex) && typeof ex.id === 'string' && typeof ex.name === 'string')))) return null
  if (!memberships.every(m => typeof m.id === 'string' && memberIds.has(m.memberId) &&
      typeof m.planName === 'string' && typeof m.startsAt === 'string' &&
      typeof m.endsAt === 'string' && Number.isFinite(m.price) && Number(m.price) >= 0)) return null
  const membershipById = new Map(memberships.map(m => [m.id, m]))
  if (!payments.every(p => typeof p.id === 'string' && typeof p.paidAt === 'string' &&
      typeof p.membershipId === 'string' && membershipById.get(p.membershipId)?.memberId === p.memberId &&
      Number.isFinite(p.amount) && Number(p.amount) > 0 &&
      ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].includes(String(p.method)))) return null
  if (!sessions.every(s => typeof s.id === 'string' && memberIds.has(s.memberId) &&
      typeof s.performedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.performedAt) &&
      typeof s.routineName === 'string' && (s.routineId === undefined || typeof s.routineId === 'string') &&
      (s.day === null || (Number.isInteger(s.day) && Number(s.day) >= 1 && Number(s.day) <= 7)) &&
      (s.block === undefined || (Number.isInteger(s.block) && Number(s.block) >= 1 && Number(s.block) <= 104)) &&
      (s.week === undefined || (Number.isInteger(s.week) && Number(s.week) >= 1 && Number(s.week) <= 104)) &&
      typeof s.notes === 'string' && (s.review === undefined || (isObject(s.review) &&
        typeof s.review.trainer === 'string' && typeof s.review.notes === 'string' &&
        typeof s.review.reviewedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.review.reviewedAt))) &&
      (s.results === undefined || (Array.isArray(s.results) &&
        s.results.every(result => isObject(result) && typeof result.exerciseId === 'string' &&
          typeof result.name === 'string' && (result.comment === undefined || (typeof result.comment === 'string' && result.comment.length <= 300)) && ['sets', 'reps', 'load', 'rir'].every(key => typeof result[key] === 'string')))))) return null
  return { ...value, sessions } as Data
}

const STORAGE_KEY = 'gns-training:v1'
const asText = (value: unknown) => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function readJson(key: string): unknown {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function createId(): string { return crypto.randomUUID() }

function legacyRoutine(raw: unknown, memberId: string): Routine | null {
  if (!isObject(raw)) return null
  const byDay = isObject(raw.ejerciciosPorDia) ? raw.ejerciciosPorDia : {}
  const exercisesByDay: Record<number, Exercise[]> = {}
  for (const [day, exercises] of Object.entries(byDay)) {
    const dayNumber = Number(day)
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || !Array.isArray(exercises)) continue
    exercisesByDay[dayNumber] = exercises.filter(isObject).map(item => ({
      id: createId(), name: asText(item.nombre), sets: asText(item.series),
      reps: asText(item.repeticiones), load: asText(item.carga), rir: asText(item.rir),
      rest: asText(item.descanso), tempo: asText(item.tempo), notes: asText(item.observaciones),
    }))
  }
  return {
    id: createId(), memberId, name: asText(raw.nombre) || 'Rutina anterior',
    goal: asText(raw.objetivo), level: asText(raw.nivel),
    daysPerWeek: Math.max(1, Math.min(7, Number(raw.diasPorSemana) || 1)),
    exercisesByDay, createdAt: new Date().toISOString(),
  }
}

export function loadData(): Data {
  const current = readJson(STORAGE_KEY)
  if (isObject(current) && Array.isArray(current.members) && Array.isArray(current.routines)) {
    return { members: current.members as Member[], routines: current.routines as Routine[],
      memberships: Array.isArray(current.memberships) ? current.memberships as Membership[] : [],
      payments: Array.isArray(current.payments) ? current.payments as Payment[] : [],
      sessions: Array.isArray(current.sessions) ? current.sessions as TrainingSession[] : [] }
  }

  // Importación de la versión original: nunca borra ni modifica sus claves.
  const oldMembers = readJson('alumnos')
  if (!Array.isArray(oldMembers)) return { members: [], routines: [], memberships: [], payments: [], sessions: [] }
  const members: Member[] = oldMembers.filter(isObject).map(old => ({
    id: createId(), firstName: asText(old.nombre), lastName: asText(old.apellido),
    phone: asText(old.telefono), email: asText(old.correo),
    birthDate: asText(old.fechaNacimiento), joinedAt: new Date().toISOString().slice(0, 10),
    status: 'Activo', notes: asText(old.observaciones),
  }))
  const routines: Routine[] = []
  for (const member of members) {
    // En la versión anterior el nombre era la única clave. Con homónimos no se
    // puede saber a quién pertenece la rutina; evitamos asignarla al azar.
    const sameName = members.filter(item => item.firstName === member.firstName && item.lastName === member.lastName)
    if (sameName.length !== 1) continue
    const old = readJson(`rutina-${member.firstName}-${member.lastName}`)
    const routine = legacyRoutine(old, member.id)
    if (routine) routines.push(routine)
  }
  const imported = { members, routines, memberships: [], payments: [], sessions: [] }
  saveData(imported)
  return imported
}

export function saveData(data: Data): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}
