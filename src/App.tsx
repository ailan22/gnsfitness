import { useState, type ChangeEvent, type FormEvent } from 'react'
import { createId, loadData, saveData, validateBackup, type Data, type Exercise, type Member, type Membership, type Payment, type Routine, type SessionComponent, type SessionExerciseResult, type TrainingSession } from './data'
import { daysUntil, membershipEnd } from './membership'
import CloudAccount from './CloudAccount'
import './App.css'
import './Workspace.css'

type Page = 'home' | 'members' | 'member' | 'student' | 'new-member' | 'edit-member' | 'routine' | 'new-routine' | 'edit-routine' | 'new-membership' | 'new-payment' | 'new-session'
type PlanFilter = 'Todos' | 'Al día' | 'Por vencer' | 'Vencidos' | 'Sin plan'
type PaymentFilter = 'Todos' | 'Con saldo pendiente' | 'Sin saldo pendiente'
const plans = [{ name: 'Mensual', months: 1 }, { name: 'Trimestral', months: 3 }, { name: 'Semestral', months: 6 }, { name: 'Anual', months: 12 }]
const money = (amount: number) => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 2 }).format(amount)
const cents = (amount: number) => Math.round(amount * 100)
const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-UY')
function dueLabel(end: string) {
  const days = daysUntil(end, todayLocal())
  return days === null ? 'Fecha inválida' : days < 0 ? `Vencido hace ${-days} día${days === -1 ? '' : 's'}`
    : days === 0 ? 'Vence hoy' : days <= 10 ? `Vence en ${days} días` : 'Al día'
}
const blankMember = { firstName: '', lastName: '', phone: '', email: '', birthDate: '', joinedAt: '',
  emergencyContactName: '', emergencyContactPhone: '', goal: '', limitations: '', trainer: '', notes: '' }
const blankExercise = { name: '', sets: '', reps: '', load: '', rir: '', rest: '', tempo: '', notes: '' }
function dayExercises(routine: Routine, day: number, block: number, week = 1): Exercise[] {
  for (let previous = week; previous > 1; previous--) {
    const planned = routine.weekExercises?.[block]?.[previous]?.[day]
    if (planned) return planned
  }
  if (block > 1) {
    const planned = routine.blockExercises?.[block]?.[day]
    if (planned) return planned
    const previousWeek = Math.min(routine.blockRounds ?? 4, (routine.programRounds ?? 24) - (block - 2) * (routine.blockRounds ?? 4))
    return dayExercises(routine, day, block - 1, previousWeek)
  }
  return routine.exercisesByDay[day] ?? []
}
function dayGuidance(routine: Pick<Routine, 'sessionGuidance' | 'blockRounds' | 'programRounds'>, day: number, block: number, week: number): string {
  for (let previous = week; previous >= 1; previous--) {
    const note = routine.sessionGuidance?.[block]?.[previous]?.[day]
    if (note !== undefined) return note
  }
  if (block > 1) {
    const previousWeek = Math.min(routine.blockRounds ?? 4, (routine.programRounds ?? 24) - (block - 2) * (routine.blockRounds ?? 4))
    return dayGuidance(routine, day, block - 1, previousWeek)
  }
  return ''
}
function dayComponents(routine: Pick<Routine, 'sessionComponents' | 'blockRounds' | 'programRounds'>, day: number, block: number, week: number): SessionComponent[] {
  for (let previous = week; previous >= 1; previous--) {
    const components = routine.sessionComponents?.[block]?.[previous]?.[day]
    if (components) return components
  }
  if (block > 1) {
    const previousWeek = Math.min(routine.blockRounds ?? 4, (routine.programRounds ?? 24) - (block - 2) * (routine.blockRounds ?? 4))
    return dayComponents(routine, day, block - 1, previousWeek)
  }
  return []
}
type MemberForm = typeof blankMember

function todayLocal() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function ageOn(birthDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const born = new Date(year, month - 1, day)
  if (born.getFullYear() !== year || born.getMonth() !== month - 1 || born.getDate() !== day) return null
  const now = new Date()
  const age = now.getFullYear() - year - (now.getMonth() + 1 < month ||
    (now.getMonth() + 1 === month && now.getDate() < day) ? 1 : 0)
  return age >= 0 && age <= 130 ? age : null
}

function MemberFields({ form, onChange }: { form: MemberForm; onChange: (next: MemberForm) => void }) {
  const field = (key: keyof MemberForm, value: string) => onChange({ ...form, [key]: value })
  return <>
    <div className="grid">
      <label>Nombre *<input required value={form.firstName} onChange={e => field('firstName', e.target.value)}/></label>
      <label>Apellido *<input required value={form.lastName} onChange={e => field('lastName', e.target.value)}/></label>
      <label>Teléfono<input type="tel" value={form.phone} onChange={e => field('phone', e.target.value)}/></label>
      <label>Correo<input type="email" value={form.email} onChange={e => field('email', e.target.value)}/></label>
      <label>Fecha de nacimiento<input type="date" max={todayLocal()} value={form.birthDate} onChange={e => field('birthDate', e.target.value)}/></label>
      <label>Fecha de alta *<input type="date" required max={todayLocal()} value={form.joinedAt} onChange={e => field('joinedAt', e.target.value)}/></label>
    </div>
    <h2>Contacto de emergencia</h2>
    <div className="grid form-section">
      <label>Nombre del contacto<input value={form.emergencyContactName} onChange={e => field('emergencyContactName', e.target.value)}/></label>
      <label>Teléfono del contacto<input type="tel" value={form.emergencyContactPhone} onChange={e => field('emergencyContactPhone', e.target.value)}/></label>
    </div>
    <h2>Perfil de entrenamiento</h2>
    <div className="grid form-section">
      <label>Objetivo<input value={form.goal} onChange={e => field('goal', e.target.value)}/></label>
      <label>Entrenador asignado<input value={form.trainer} onChange={e => field('trainer', e.target.value)}/></label>
    </div>
    <label>Limitaciones o cuidados<textarea value={form.limitations} onChange={e => field('limitations', e.target.value)}/></label>
    <label>Observaciones administrativas<textarea value={form.notes} onChange={e => field('notes', e.target.value)}/></label>
  </>
}

function SessionComponents({ items }: { items: SessionComponent[] }) {
  if (!items.length) return null
  return <div className="session-components"><strong>Componentes de la sesión</strong>
    {items.map(item => <div className="session-component" key={item.id}><strong>{item.title}</strong><p>{item.details}</p></div>)}
  </div>
}

function App() {
  const cloudConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  const [access, setAccess] = useState<'checking' | 'student' | 'admin' | 'other' | 'signed-out'>(
    cloudConfigured ? 'checking' : 'admin')
  const [data, setData] = useState<Data>(loadData)
  const [page, setPage] = useState<Page>('home')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [routineId, setRoutineId] = useState<string | null>(null)
  const [copyTargetId, setCopyTargetId] = useState('')
  const [memberForm, setMemberForm] = useState(blankMember)
  const [routineForm, setRoutineForm] = useState({ name: '', goal: '', level: '', days: 3, programRounds: 24, blockRounds: 4 })
  const [exercises, setExercises] = useState<Record<number, Exercise[]>>({})
  const [blockExercises, setBlockExercises] = useState<NonNullable<Routine['blockExercises']>>({})
  const [weekExercises, setWeekExercises] = useState<NonNullable<Routine['weekExercises']>>({})
  const [blockDetails, setBlockDetails] = useState<NonNullable<Routine['blockDetails']>>({})
  const [sessionGuidance, setSessionGuidance] = useState<NonNullable<Routine['sessionGuidance']>>({})
  const [sessionComponents, setSessionComponents] = useState<NonNullable<Routine['sessionComponents']>>({})
  const [viewBlock, setViewBlock] = useState(1)
  const [editing, setEditing] = useState<{ block: number; week: number; day: number; id: string | null } | null>(null)
  const [exerciseForm, setExerciseForm] = useState(blankExercise)
  const [componentEditing, setComponentEditing] = useState<{ block: number; week: number; day: number; id: string | null } | null>(null)
  const [componentForm, setComponentForm] = useState({ title: '', details: '' })
  const [membershipForm, setMembershipForm] = useState({ planName: 'Mensual', startsAt: todayLocal(), price: '' })
  const [paymentForm, setPaymentForm] = useState<{ paidAt: string; amount: string; method: Payment['method'] }>({ paidAt: todayLocal(), amount: '', method: 'Efectivo' })
  const [sessionForm, setSessionForm] = useState({ performedAt: todayLocal(), routineId: '', day: '', notes: '' })
  const [sessionResults, setSessionResults] = useState<SessionExerciseResult[]>([])
  const [reviewingSessionId, setReviewingSessionId] = useState<string | null>(null)
  const [reviewForm, setReviewForm] = useState({ trainer: '', notes: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [planFilter, setPlanFilter] = useState<PlanFilter>('Todos')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('Todos')
  const member = data.members.find(item => item.id === memberId)
  const memberships = data.memberships.filter(item => item.memberId === memberId).reverse()
  const currentMembership = memberships[0]
  const membershipPayments = data.payments.filter(item => item.membershipId === currentMembership?.id).reverse()
  const paidCents = membershipPayments.reduce((total, item) => total + cents(item.amount), 0)
  const pendingCents = currentMembership ? Math.max(0, cents(currentMembership.price) - paidCents) : 0
  const dueMemberships = data.memberships.filter(item => !data.memberships.some(other => other.memberId === item.memberId && data.memberships.indexOf(other) > data.memberships.indexOf(item)))
  const expiring = dueMemberships.filter(item => { const days = daysUntil(item.endsAt, todayLocal()); return days !== null && days >= 0 && days <= 10 }).length
  const expired = dueMemberships.filter(item => { const days = daysUntil(item.endsAt, todayLocal()); return days !== null && days < 0 }).length
  const monthlyIncome = data.payments.filter(item => item.paidAt.startsWith(todayLocal().slice(0, 7))).reduce((total, item) => total + cents(item.amount), 0) / 100
  const memberRoutines = data.routines.filter(item => item.memberId === memberId).reverse()
  const memberSessions = data.sessions.filter(item => item.memberId === memberId).sort((a, b) => b.performedAt.localeCompare(a.performedAt))
  const currentRoutine = memberRoutines[0]
  const routineNameUnique = currentRoutine && memberRoutines.filter(item => item.name === currentRoutine.name).length === 1
  const lastRoutineSession = currentRoutine ? [...data.sessions].reverse()
    .filter(item => item.memberId === memberId && item.day !== null && item.performedAt <= todayLocal() &&
      (item.routineId === currentRoutine.id || (!item.routineId && routineNameUnique && item.routineName === currentRoutine.name)))
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0] : undefined
  const nextRoutineDay = currentRoutine ? ((lastRoutineSession?.day || 0) % currentRoutine.daysPerWeek) + 1 : null
  // Una vuelta requiere registrar todos los días de la rutina en orden. Las sesiones sin día no cuentan.
  const orderedRoutineDays = currentRoutine ? data.sessions.map((item, index) => ({ item, index }))
    .filter(({ item }) => item.memberId === memberId && item.day !== null && item.performedAt <= todayLocal() &&
      (item.routineId === currentRoutine.id || (!item.routineId && routineNameUnique && item.routineName === currentRoutine.name)))
    .sort((a, b) => a.item.performedAt.localeCompare(b.item.performedAt) || a.index - b.index) : []
  let completedRounds = 0
  let expectedDay = 1
  for (const { item } of orderedRoutineDays) {
    if (item.day === expectedDay) {
      if (expectedDay === currentRoutine?.daysPerWeek) { completedRounds++; expectedDay = 1 }
      else expectedDay++
    } else if (item.day === 1) expectedDay = 2
  }
  const programRounds = currentRoutine?.programRounds ?? 24
  const blockRounds = currentRoutine?.blockRounds ?? 4
  const programFinished = completedRounds >= programRounds
  const currentBlock = Math.min(Math.floor(completedRounds / blockRounds) + 1, Math.ceil(programRounds / blockRounds))
  const blockStart = (currentBlock - 1) * blockRounds + 1
  const blockEnd = Math.min(currentBlock * blockRounds, programRounds)
  const currentWeek = Math.min(Math.max(1, completedRounds + 1 - blockStart), blockEnd - blockStart + 1)
  const globalWeek = blockStart + currentWeek - 1
  const programProgress = programFinished
    ? `Programa completado · ${completedRounds} vueltas registradas`
    : `Semana ${globalWeek} de ${programRounds} · Bloque ${currentBlock} (semanas ${blockStart}–${blockEnd}) · ${completedRounds} semanas completas`
  function plannedEditorDay(block: number, week: number, day: number): Exercise[] {
    for (let previous = week; previous > 1; previous--) {
      const planned = weekExercises[block]?.[previous]?.[day]
      if (planned) return planned
    }
    if (block > 1) {
      const planned = blockExercises[block]?.[day]
      if (planned) return planned
      return plannedEditorDay(block - 1, routineForm.blockRounds, day)
    }
    return exercises[day] ?? []
  }
  function plannedEditorGuidance(block: number, week: number, day: number): string {
    return dayGuidance({ sessionGuidance, blockRounds: routineForm.blockRounds,
      programRounds: routineForm.programRounds }, day, block, week)
  }
  function plannedEditorComponents(block: number, week: number, day: number): SessionComponent[] {
    return dayComponents({ sessionComponents, blockRounds: routineForm.blockRounds,
      programRounds: routineForm.programRounds }, day, block, week)
  }
  const selectedSessionRoutine = memberRoutines.find(item => item.id === sessionForm.routineId)
  const sessionBlock = selectedSessionRoutine && selectedSessionRoutine.id === currentRoutine?.id ? currentBlock : 1
  const sessionWeek = sessionBlock === currentBlock && selectedSessionRoutine?.id === currentRoutine?.id ? currentWeek : 1
  const sessionDayExercises = selectedSessionRoutine && sessionForm.day ? dayExercises(selectedSessionRoutine, Number(sessionForm.day), sessionBlock, sessionWeek) : []
  const routine = data.routines.find(item => item.id === routineId)
  const currentPlanFor = (id: string) => [...data.memberships].reverse().find(item => item.memberId === id)
  const balanceFor = (id: string) => {
    const plan = currentPlanFor(id)
    if (!plan) return 0
    const received = data.payments.filter(item => item.membershipId === plan.id).reduce((total, item) => total + cents(item.amount), 0)
    return Math.max(0, cents(plan.price) - received)
  }
  const debtors = data.members.filter(item => balanceFor(item.id) > 0)
  const pendingTotal = debtors.reduce((total, item) => total + balanceFor(item.id), 0) / 100
  const sessionsThisMonth = data.sessions.filter(item => item.performedAt.startsWith(todayLocal().slice(0, 7))).length
  const visibleMembers = data.members.filter(item => {
    const query = searchable(memberSearch.trim())
    if (query && !searchable(`${item.firstName} ${item.lastName} ${item.phone} ${item.email} ${item.id}`).includes(query)) return false
    if (statusFilter !== 'Todos' && item.status !== statusFilter) return false
    if (paymentFilter === 'Con saldo pendiente' && balanceFor(item.id) === 0) return false
    if (paymentFilter === 'Sin saldo pendiente' && balanceFor(item.id) > 0) return false
    const plan = [...data.memberships].reverse().find(entry => entry.memberId === item.id)
    const days = plan ? daysUntil(plan.endsAt, todayLocal()) : null
    if (planFilter === 'Sin plan') return !plan
    if (planFilter === 'Vencidos') return days !== null && days < 0
    if (planFilter === 'Por vencer') return days !== null && days >= 0 && days <= 10
    if (planFilter === 'Al día') return days !== null && days > 10
    return true
  })

  function commit(next: Data): boolean {
    if (!saveData(next)) {
      setError('No se pudo guardar en este navegador. Revisá el espacio disponible y descargá un respaldo.')
      return false
    }
    setError('')
    setData(next)
    return true
  }
  function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!memberForm.firstName.trim() || !memberForm.lastName.trim()) return
    const next: Member = { ...memberForm, id: createId(), firstName: memberForm.firstName.trim(),
      lastName: memberForm.lastName.trim(), joinedAt: memberForm.joinedAt, status: 'Activo' }
    if (commit({ ...data, members: [...data.members, next] })) {
      setMemberForm(blankMember); setMemberId(next.id); setPage('member')
    }
  }
  function editMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!member || !memberForm.firstName.trim() || !memberForm.lastName.trim()) return
    const updated: Member = { ...member, ...memberForm,
      firstName: memberForm.firstName.trim(), lastName: memberForm.lastName.trim() }
    if (commit({ ...data, members: data.members.map(item => item.id === member.id ? updated : item) })) {
      setPage('member')
    }
  }
  function startEditMember() {
    if (!member) return
    setMemberForm({ firstName: member.firstName, lastName: member.lastName,
      phone: member.phone || '', email: member.email || '', birthDate: member.birthDate || '',
      joinedAt: member.joinedAt || todayLocal(), notes: member.notes || '',
      emergencyContactName: member.emergencyContactName || '', emergencyContactPhone: member.emergencyContactPhone || '',
      goal: member.goal || '', limitations: member.limitations || '', trainer: member.trainer || '' })
    setPage('edit-member')
  }
  function startRoutine() {
    setRoutineForm({ name: '', goal: '', level: '', days: 3, programRounds: 24, blockRounds: 4 })
    setRoutineId(null); setExercises({}); setBlockExercises({}); setWeekExercises({}); setBlockDetails({}); setSessionGuidance({}); setSessionComponents({}); setEditing(null); setComponentEditing(null); setError(''); setPage('new-routine')
  }
  function startEditRoutine() {
    if (!routine) return
    setRoutineForm({ name: routine.name, goal: routine.goal, level: routine.level, days: routine.daysPerWeek, programRounds: routine.programRounds ?? 24, blockRounds: routine.blockRounds ?? 4 })
    setExercises(Object.fromEntries(Object.entries(routine.exercisesByDay).map(([day, items]) => [day, [...items]])))
    setBlockExercises(structuredClone(routine.blockExercises || {})); setWeekExercises(structuredClone(routine.weekExercises || {}))
    setBlockDetails(structuredClone(routine.blockDetails || {}))
    setSessionGuidance(structuredClone(routine.sessionGuidance || {}))
    setSessionComponents(structuredClone(routine.sessionComponents || {}))
    setEditing(null); setComponentEditing(null); setError(''); setPage('edit-routine')
  }
  function addMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const plan = plans.find(item => item.name === membershipForm.planName)
    const endsAt = plan && membershipEnd(membershipForm.startsAt, plan.months)
    const price = Number(membershipForm.price)
    if (!member || !plan || !endsAt || !Number.isFinite(price) || price <= 0) { setError('Revisá el plan, la fecha y el precio.'); return }
    const next: Membership = { id: createId(), memberId: member.id, planName: plan.name,
      months: plan.months, startsAt: membershipForm.startsAt, endsAt, price: cents(price) / 100 }
    if (commit({ ...data, memberships: [...data.memberships, next] })) setPage('member')
  }
  function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(paymentForm.amount)
    if (!member || !currentMembership || !paymentForm.paidAt || !Number.isFinite(amount) || cents(amount) <= 0 || cents(amount) > pendingCents) {
      setError('Ingresá un importe mayor a cero que no supere el saldo pendiente.'); return
    }
    const next: Payment = { id: createId(), memberId: member.id, membershipId: currentMembership.id,
      paidAt: paymentForm.paidAt, amount: cents(amount) / 100, method: paymentForm.method }
    if (commit({ ...data, payments: [...data.payments, next] })) setPage('member')
  }
  function addSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!member || !/^\d{4}-\d{2}-\d{2}$/.test(sessionForm.performedAt) || sessionForm.performedAt > todayLocal()) {
      setError('Elegí una fecha válida que no sea futura.'); return
    }
    if (sessionForm.routineId && !selectedSessionRoutine) { setError('Elegí una rutina de este socio.'); return }
    const day = sessionForm.day ? Number(sessionForm.day) : null
    if (day !== null && (!selectedSessionRoutine || !Number.isInteger(day) || day < 1 || day > selectedSessionRoutine.daysPerWeek)) {
      setError('Elegí un día válido de la rutina.'); return
    }
    const results = sessionResults.filter(item => sessionDayExercises.some(ex => ex.id === item.exerciseId))
    if (results.some(item => [item.sets, item.reps, item.load, item.rir].some(value => value.length > 60))) {
      setError('Cada resultado debe tener como máximo 60 caracteres.'); return
    }
    const next: TrainingSession = { id: createId(), memberId: member.id, performedAt: sessionForm.performedAt,
      routineId: selectedSessionRoutine?.id, routineName: selectedSessionRoutine?.name || '', day,
      block: selectedSessionRoutine && day !== null ? sessionBlock : undefined,
      week: selectedSessionRoutine && day !== null ? (sessionBlock - 1) * (selectedSessionRoutine.blockRounds ?? 4) + sessionWeek : undefined,
      notes: sessionForm.notes.trim(),
      results: results.filter(item => item.sets.trim() || item.reps.trim() || item.load.trim() || item.rir.trim()) }
    if (commit({ ...data, sessions: [...data.sessions, next] })) {
      setPage('member'); setMessage('Entrenamiento registrado en la ficha del socio.')
    }
  }
  function deleteSession(session: TrainingSession) {
    if (!member || session.memberId !== member.id) return
    if (!window.confirm(`¿Eliminar el entrenamiento del ${session.performedAt} de ${member.firstName} ${member.lastName}?`)) return
    if (commit({ ...data, sessions: data.sessions.filter(item => item.id !== session.id) })) {
      setMessage('Entrenamiento eliminado.')
    }
  }
  function startReview(session: TrainingSession) {
    setReviewingSessionId(session.id)
    setReviewForm({ trainer: session.review?.trainer || member?.trainer || '', notes: session.review?.notes || '' })
    setError('')
  }
  function saveReview(event: FormEvent<HTMLFormElement>, session: TrainingSession) {
    event.preventDefault()
    if (!member || session.memberId !== member.id || !reviewForm.trainer.trim()) {
      setError('Indicá el nombre del entrenador que revisó el entrenamiento.'); return
    }
    const updated = { ...session, review: {
      trainer: reviewForm.trainer.trim(), notes: reviewForm.notes.trim(), reviewedAt: todayLocal(),
    } }
    if (commit({ ...data, sessions: data.sessions.map(item => item.id === session.id ? updated : item) })) {
      setReviewingSessionId(null)
      setMessage('Revisión del entrenador guardada.')
    }
  }
  function updateEditorExercises(block: number, week: number, day: number, items: Exercise[]) {
    if (week > 1) setWeekExercises(current => ({ ...current, [block]: {
      ...current[block], [week]: { ...current[block]?.[week], [day]: items } } }))
    else if (block === 1) setExercises(current => ({ ...current, [day]: items }))
    else setBlockExercises(current => ({ ...current, [block]: { ...current[block], [day]: items } }))
  }
  function updateBlockDetail(block: number, key: 'name' | 'warmup' | 'objective', value: string) {
    setBlockDetails(current => ({ ...current, [block]: {
      ...(current[block] || { name: '', warmup: '', objective: '' }), [key]: value,
    } }))
  }
  function updateSessionGuidance(block: number, week: number, day: number, value: string) {
    setSessionGuidance(current => ({ ...current, [block]: { ...current[block],
      [week]: { ...current[block]?.[week], [day]: value } } }))
  }
  function updateSessionComponents(block: number, week: number, day: number, items: SessionComponent[]) {
    setSessionComponents(current => ({ ...current, [block]: { ...current[block],
      [week]: { ...current[block]?.[week], [day]: items } } }))
  }
  function saveComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!componentEditing || !componentForm.title.trim() || !componentForm.details.trim()) return
    const { block, week, day, id } = componentEditing
    const next: SessionComponent = { id: id || createId(), title: componentForm.title.trim(), details: componentForm.details.trim() }
    const current = plannedEditorComponents(block, week, day)
    updateSessionComponents(block, week, day, id
      ? current.map(item => item.id === id ? next : item)
      : [...current, next])
    setComponentEditing(null)
    setComponentForm({ title: '', details: '' })
  }
  function addExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || !exerciseForm.name.trim()) return
    const next: Exercise = { ...exerciseForm, name: exerciseForm.name.trim(), id: editing.id || createId() }
    const currentDay = plannedEditorDay(editing.block, editing.week, editing.day)
    updateEditorExercises(editing.block, editing.week, editing.day, editing.id
      ? currentDay.map(item => item.id === editing.id ? next : item)
      : [...currentDay, next])
    setEditing(null); setExerciseForm(blankExercise)
  }
  function saveRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!member || !routineForm.name.trim() || !routineForm.level) return
    if (!Number.isInteger(routineForm.programRounds) || routineForm.programRounds < 1 || routineForm.programRounds > 104 ||
        !Number.isInteger(routineForm.blockRounds) || routineForm.blockRounds < 1 || routineForm.blockRounds > routineForm.programRounds) {
      setError('Revisá las vueltas del programa y del bloque.'); return
    }
    const original = page === 'edit-routine' ? routine : undefined
    if (page === 'edit-routine' && (!original || original.memberId !== member.id)) return
    const next: Routine = { id: original?.id || createId(), memberId: member.id, name: routineForm.name.trim(),
      goal: routineForm.goal.trim(), level: routineForm.level, daysPerWeek: routineForm.days,
      programRounds: routineForm.programRounds, blockRounds: routineForm.blockRounds,
      exercisesByDay: Object.fromEntries(Object.entries(exercises).filter(([day]) => Number(day) <= routineForm.days)),
      blockExercises: Object.fromEntries(Object.entries(blockExercises)
        .filter(([block]) => Number(block) <= Math.ceil(routineForm.programRounds / routineForm.blockRounds))
        .map(([block, days]) => [block, Object.fromEntries(Object.entries(days).filter(([day]) => Number(day) <= routineForm.days))])),
      weekExercises: Object.fromEntries(Object.entries(weekExercises)
        .filter(([block]) => Number(block) <= Math.ceil(routineForm.programRounds / routineForm.blockRounds))
        .map(([block, weeks]) => [block, Object.fromEntries(Object.entries(weeks)
          .filter(([week]) => Number(week) <= Math.min(routineForm.blockRounds, routineForm.programRounds - (Number(block) - 1) * routineForm.blockRounds))
          .map(([week, days]) => [week, Object.fromEntries(Object.entries(days).filter(([day]) => Number(day) <= routineForm.days))]))])),
      blockDetails: Object.fromEntries(Object.entries(blockDetails)
        .filter(([block]) => Number(block) <= Math.ceil(routineForm.programRounds / routineForm.blockRounds))
        .map(([block, details]) => [block, { name: details.name.trim(), warmup: details.warmup.trim(), objective: details.objective.trim() }])),
      sessionGuidance: Object.fromEntries(Object.entries(sessionGuidance)
        .filter(([block]) => Number(block) <= Math.ceil(routineForm.programRounds / routineForm.blockRounds))
        .map(([block, weeks]) => [block, Object.fromEntries(Object.entries(weeks)
          .filter(([week]) => Number(week) <= Math.min(routineForm.blockRounds, routineForm.programRounds - (Number(block) - 1) * routineForm.blockRounds))
          .map(([week, days]) => [week, Object.fromEntries(Object.entries(days)
            .filter(([day]) => Number(day) <= routineForm.days)
            .map(([day, note]) => [day, note.trim()]))]))])),
      sessionComponents: Object.fromEntries(Object.entries(sessionComponents)
        .filter(([block]) => Number(block) <= Math.ceil(routineForm.programRounds / routineForm.blockRounds))
        .map(([block, weeks]) => [block, Object.fromEntries(Object.entries(weeks)
          .filter(([week]) => Number(week) <= Math.min(routineForm.blockRounds, routineForm.programRounds - (Number(block) - 1) * routineForm.blockRounds))
          .map(([week, days]) => [week, Object.fromEntries(Object.entries(days)
            .filter(([day]) => Number(day) <= routineForm.days))]))])),
      createdAt: original?.createdAt || new Date().toISOString() }
    const updatedRoutines = original ? data.routines.map(item => item.id === original.id ? next : item) : [...data.routines, next]
    if (commit({ ...data, routines: updatedRoutines })) { setRoutineId(next.id); setViewBlock(1); setPage('routine') }
  }
  function copyRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!routine || !copyTargetId || copyTargetId === routine.memberId || !data.members.some(item => item.id === copyTargetId)) {
      setError('Elegí otro socio para copiar la rutina.')
      return
    }
    const next: Routine = {
      ...routine, id: createId(), memberId: copyTargetId, createdAt: new Date().toISOString(),
      exercisesByDay: Object.fromEntries(Object.entries(routine.exercisesByDay).map(([day, items]) =>
        [day, items.map(item => ({ ...item, id: createId() }))])),
      blockExercises: Object.fromEntries(Object.entries(routine.blockExercises || {}).map(([block, days]) =>
        [block, Object.fromEntries(Object.entries(days).map(([day, items]) =>
          [day, items.map(item => ({ ...item, id: createId() }))]))])),
      weekExercises: Object.fromEntries(Object.entries(routine.weekExercises || {}).map(([block, weeks]) =>
        [block, Object.fromEntries(Object.entries(weeks).map(([week, days]) =>
          [week, Object.fromEntries(Object.entries(days).map(([day, items]) =>
            [day, items.map(item => ({ ...item, id: createId() }))]))]))])),
      blockDetails: structuredClone(routine.blockDetails || {}),
      sessionGuidance: structuredClone(routine.sessionGuidance || {}),
      sessionComponents: Object.fromEntries(Object.entries(routine.sessionComponents || {}).map(([block, weeks]) =>
        [block, Object.fromEntries(Object.entries(weeks).map(([week, days]) =>
          [week, Object.fromEntries(Object.entries(days).map(([day, items]) =>
            [day, items.map(item => ({ ...item, id: createId() }))]))]))])),
    }
    if (commit({ ...data, routines: [...data.routines, next] })) {
      setMemberId(copyTargetId); setRoutineId(next.id); setViewBlock(1); setCopyTargetId(''); setPage('routine')
      setMessage('Rutina copiada. Esta copia se puede editar sin cambiar la rutina original.')
    }
  }
  function deleteRoutine() {
    if (!routine || !member || routine.memberId !== member.id) return
    if (!window.confirm(`¿Eliminar la rutina «${routine.name}» de ${member.firstName} ${member.lastName}? Esta acción elimina solo esta rutina y no se puede deshacer. Podés descargar un respaldo antes de continuar.`)) return
    if (commit({ ...data, routines: data.routines.filter(item => item.id !== routine.id) })) {
      setRoutineId(null); setCopyTargetId(''); setPage('member')
      setMessage('Rutina eliminada de la ficha de este socio.')
    }
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = `gns-respaldo-${new Date().toISOString().slice(0, 10)}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  async function restoreData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setMessage('')
    if (file.size > 10_000_000) { setError('El respaldo supera los 10 MB.'); return }
    let restored: Data | null = null
    try { restored = validateBackup(JSON.parse(await file.text())) } catch { /* Archivo ilegible */ }
    if (!restored) { setError('El archivo no es un respaldo válido de GNS Fitness. No se cambió ningún dato.'); return }
    if (!window.confirm(`El respaldo contiene ${restored.members.length} socios, ${restored.memberships.length} planes, ${restored.payments.length} pagos y ${restored.sessions.length} entrenamientos. Restaurarlo reemplazará TODOS los datos actuales de este navegador. Descargá un respaldo de los datos actuales antes de continuar. ¿Querés restaurarlo?`)) return
    if (commit(restored)) {
      setMemberId(null); setRoutineId(null); setPage('home')
      setMessage(`Respaldo restaurado: ${restored.members.length} socios, ${restored.memberships.length} planes, ${restored.payments.length} pagos y ${restored.sessions.length} entrenamientos.`)
    }
  }
  return <div className={`app ${cloudConfigured && access === 'admin' ? 'app-admin' : ''}`}>
    <header className="topbar"><button className="brand" onClick={() => { if (access === 'admin') setPage(page === 'student' ? 'member' : 'home') }}>
      {access === 'admin' && <img className="brand-logo" src="/gns-logo-transparent.png" alt="" width="48" height="48"/>}
      <span className="brand-copy"><span className="brand-title">GNS <span>FITNESS</span></span>
        {(access === 'student' || access === 'admin') && <span className="brand-motto">ENERGÍA · SALUD · BIENESTAR · VITALIDAD</span>}</span>
    </button><span className="tag">{access === 'student' ? 'Portal del alumno' : access === 'admin' ? 'Panel de gestión' : 'Tu espacio de entrenamiento'}</span></header>
    <main className="content">
      {access === 'admin' && !cloudConfigured && <>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {page !== 'home' && <button className="back" onClick={() => { setError(''); setPage(page === 'members' ? 'home' : page === 'member' ? 'members' : page === 'new-member' ? 'members' : page === 'edit-routine' ? 'routine' : 'member') }}>← Volver</button>}
      {page === 'home' && <>
        <p className="eyebrow">GESTIÓN DEL GIMNASIO</p><h1>Tu espacio de trabajo.</h1>
        <p className="muted">Una base ordenada para construir la plataforma GNS.</p>
        <div className="stats"><div className="card"><span>Socios registrados</span><strong>{data.members.length}</strong></div><div className="card"><span>Socios activos</span><strong>{data.members.filter(m => m.status === 'Activo').length}</strong></div><div className="card"><span>Vencidos</span><strong className="red">{expired}</strong></div><div className="card"><span>Por vencer (10 días)</span><strong className="yellow">{expiring}</strong></div><div className="card"><span>Ingresos del mes</span><strong className="amount">{money(monthlyIncome)}</strong></div><button className="card stat-link" onClick={() => { setMemberSearch(''); setStatusFilter('Todos'); setPlanFilter('Todos'); setPaymentFilter('Con saldo pendiente'); setPage('members') }}><span>Saldo pendiente de cobro · {debtors.length} socio{debtors.length === 1 ? '' : 's'}</span><strong className="amount">{money(pendingTotal)}</strong><small>Ver socios con saldo →</small></button><div className="card"><span>Rutinas creadas</span><strong>{data.routines.length}</strong></div><div className="card"><span>Entrenamientos del mes</span><strong>{sessionsThisMonth}</strong></div></div>
        <div className="actions"><button onClick={() => setPage('members')}>Ver socios →</button><button className="secondary" onClick={exportData}>Descargar respaldo</button><label className="restore-button">Restaurar respaldo<input type="file" accept=".json,application/json" onChange={restoreData}/></label></div>
        <p className="notice">El panel de gestión y la vista del alumno siguen siendo demostraciones locales. En la sección conectada podés consultar los socios y el historial que ya importaste a Supabase, además de editar fichas y corregir series y repeticiones. Los cambios posteriores de una sección no se sincronizan con la otra.</p>
      </>}
      {page === 'members' && <>
        <div className="heading"><div><p className="eyebrow">ADMINISTRACIÓN</p><h1>Socios</h1></div><button onClick={() => { setMemberForm({ ...blankMember, joinedAt: todayLocal() }); setPage('new-member') }}>+ Nuevo socio</button></div>
        {data.members.length > 0 && <><div className="member-filters">
          <label>Buscar socio<input type="search" placeholder="Nombre, teléfono, correo o ID" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}/></label>
          <label>Estado<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>{['Todos', 'Activo', 'Inactivo', 'Pausado', 'Baja'].map(status => <option key={status}>{status}</option>)}</select></label>
          <label>Plan<select value={planFilter} onChange={e => setPlanFilter(e.target.value as PlanFilter)}>{(['Todos', 'Al día', 'Por vencer', 'Vencidos', 'Sin plan'] as const).map(status => <option key={status}>{status}</option>)}</select></label>
          <label>Pago<select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as PaymentFilter)}>{(['Todos', 'Con saldo pendiente', 'Sin saldo pendiente'] as const).map(status => <option key={status}>{status}</option>)}</select></label>
        </div><p className="muted results-count">Mostrando {visibleMembers.length} de {data.members.length} socios</p></>}
        {data.members.length === 0 ? <div className="card empty">Todavía no hay socios cargados.</div> : visibleMembers.length === 0 ? <div className="card empty">No hay socios que coincidan con la búsqueda o los filtros.</div> : <div className="list">{visibleMembers.map(item => { const plan = currentPlanFor(item.id); const days = plan ? daysUntil(plan.endsAt, todayLocal()) : null; const balance = balanceFor(item.id); return <button className="list-item" key={item.id} onClick={() => { setMemberId(item.id); setPage('member') }}><span><strong>{item.firstName} {item.lastName}</strong><small>{item.email || item.phone || 'Sin contacto registrado'}</small>{balance > 0 && <small className="balance-due">Saldo pendiente: {money(balance / 100)}</small>}</span><span className="status">{item.status}</span><span className={`badge ${days !== null && days < 0 ? 'danger' : days !== null && days <= 10 ? 'warning' : ''}`}>{plan ? dueLabel(plan.endsAt) : 'Sin plan'}</span><span aria-hidden="true">→</span></button> })}</div>}
      </>}
      {page === 'new-member' && <>
        <p className="eyebrow">ADMINISTRACIÓN</p><h1>Nuevo socio</h1>
        <form className="card form" onSubmit={addMember}><MemberFields form={memberForm} onChange={setMemberForm}/><button type="submit">Guardar socio</button></form>
      </>}
      {page === 'edit-member' && member && <>
        <p className="eyebrow">ADMINISTRACIÓN · {member.id.slice(0, 8).toUpperCase()}</p><h1>Editar datos del socio</h1>
        <form className="card form" onSubmit={editMember}><MemberFields form={memberForm} onChange={setMemberForm}/><button type="submit">Guardar cambios</button></form>
      </>}
      {page === 'student' && member && <>
        <p className="eyebrow">VISTA DEL ALUMNO · DEMOSTRACIÓN</p>
        <h1>Hola, {member.firstName}.</h1>
        <p className="muted">Tu entrenamiento avanza cuando completás y registrás un día; no depende del día de la semana.</p>
        {!currentRoutine || !nextRoutineDay ? <div className="card empty">Todavía no tenés una rutina asignada.</div> : <>
          <section className="card student-today">
            <p className="eyebrow">TU PRÓXIMO ENTRENAMIENTO</p>
            <h2>Día {nextRoutineDay}</h2>
            <p>{currentRoutine.name} · {currentRoutine.level} · {currentRoutine.daysPerWeek} días por semana</p>
            {lastRoutineSession && <p className="muted">Último día registrado: Día {lastRoutineSession.day} · {lastRoutineSession.performedAt}</p>}
          <p className="student-progress">{programProgress}</p>
            {currentRoutine.blockDetails?.[currentBlock]?.warmup && <div className="block-note"><strong>Calentamiento del bloque</strong><p>{currentRoutine.blockDetails[currentBlock].warmup}</p></div>}
            {currentBlock > 1 && !currentRoutine.blockExercises?.[currentBlock] && !currentRoutine.weekExercises?.[currentBlock] && <p className="muted">Este bloque todavía no tiene planificación propia. Se mantiene la última planificación disponible; consultá al entrenador antes de entrenar.</p>}
            {programFinished && <p className="muted">Revisá con tu entrenador el siguiente programa antes de continuar.</p>}
            {dayExercises(currentRoutine, nextRoutineDay, currentBlock, currentWeek).length === 0 ?
              <p className="muted">Todavía no hay ejercicios cargados para este día. Consultá con tu entrenador antes de entrenar.</p> :
              <div className="student-exercises">{dayExercises(currentRoutine, nextRoutineDay, currentBlock, currentWeek).map((ex, index) =>
                <div className="student-exercise" key={ex.id}><strong>{index + 1}. {ex.name}</strong><span>{ex.sets || '—'} series · {ex.reps || '—'} repeticiones · RIR {ex.rir || '—'} · Descanso {ex.rest || '—'}{ex.load ? ` · Carga ${ex.load}` : ''}</span>{ex.notes && <span>{ex.notes}</span>}</div>)}</div>}
            {dayGuidance(currentRoutine, nextRoutineDay, currentBlock, currentWeek) && <div className="session-guidance"><strong>Indicaciones para este día</strong><p>{dayGuidance(currentRoutine, nextRoutineDay, currentBlock, currentWeek)}</p></div>}
            <SessionComponents items={dayComponents(currentRoutine, nextRoutineDay, currentBlock, currentWeek)}/>
          </section>
          {memberSessions.some(item => item.review?.notes) && <section className="student-feedback" aria-label="Mensajes de tu entrenador">
            <h2>Mensajes de tu entrenador</h2>
            <div className="list">{memberSessions.filter(item => item.review?.notes).map(item => <article className="card student-feedback-item" key={item.id}>
              <strong>{item.review!.trainer} · {item.review!.reviewedAt}</strong>
              <p className="muted">Entrenamiento del {item.performedAt} · {item.routineName || 'Sin rutina'}{item.day ? ` · Día ${item.day}` : ''}</p>
              <p>{item.review!.notes}</p>
            </article>)}</div>
          </section>}
          <h2 className="student-program-title">Bloque {currentBlock}{currentRoutine.blockDetails?.[currentBlock]?.name ? ` · ${currentRoutine.blockDetails[currentBlock].name}` : ''}</h2>
          <p className="muted">{currentRoutine.goal || 'Sin objetivo registrado'} · {currentRoutine.name}. Cada semana tiene {currentRoutine.daysPerWeek} días planificados.</p>
          {currentRoutine.blockDetails?.[currentBlock]?.warmup && <section className="card block-note"><h3>Calentamiento específico del bloque</h3><p>{currentRoutine.blockDetails[currentBlock].warmup}</p></section>}
          {Array.from({ length: blockEnd - blockStart + 1 }, (_, index) => index + 1).map(week =>
            <section className="program-week" key={week}>
              <h3>Semana {blockStart + week - 1} · Bloque {currentBlock}{week === currentWeek ? ' · Actual' : ''}</h3>
              {week > 1 && !currentRoutine.weekExercises?.[currentBlock]?.[week] && <p className="muted">Se mantiene la última planificación disponible.</p>}
              <div className="student-program">{Array.from({ length: currentRoutine.daysPerWeek }, (_, index) => index + 1).map(day =>
                <section className={`card student-day ${week === currentWeek && day === nextRoutineDay ? 'student-day-next' : ''}`} key={day}>
                  <h4>Día {day}{week === currentWeek && day === nextRoutineDay ? ' · Próximo' : ''}</h4>
                  {dayExercises(currentRoutine, day, currentBlock, week).length === 0 ? <p className="muted">Sin ejercicios cargados.</p> :
                    dayExercises(currentRoutine, day, currentBlock, week).map(ex => <p key={ex.id}><strong>{ex.name}</strong> · {ex.sets || '—'} × {ex.reps || '—'}</p>)}
                  {dayGuidance(currentRoutine, day, currentBlock, week) && <div className="session-guidance"><strong>Indicaciones para este día</strong><p>{dayGuidance(currentRoutine, day, currentBlock, week)}</p></div>}
                  <SessionComponents items={dayComponents(currentRoutine, day, currentBlock, week)}/>
                </section>)}</div>
            </section>)}
          {currentRoutine.blockDetails?.[currentBlock]?.objective && <section className="card block-note"><h3>Objetivo y capacidades del bloque</h3><p>{currentRoutine.blockDetails[currentBlock].objective}</p></section>}
        </>}
        <p className="notice">Esta vista es una demostración en este navegador. El acceso del alumno desde su celular se incorporará cuando haya cuentas y sincronización.</p>
      </>}
      {page === 'member' && member && <>
        <p className="eyebrow">FICHA DEL SOCIO · {member.id.slice(0, 8).toUpperCase()}</p><div className="heading"><h1>{member.firstName} {member.lastName}</h1><div className="actions"><button className="secondary" onClick={() => setPage('student')}>Vista del alumno</button><button onClick={startEditMember}>Editar datos</button></div></div>
        <div className="grid"><section className="card"><h2>Datos personales</h2><p>Teléfono: {member.phone || 'Sin registrar'}</p><p>Correo: {member.email || 'Sin registrar'}</p><p>Nacimiento: {member.birthDate || 'Sin registrar'}{ageOn(member.birthDate) !== null ? ` · ${ageOn(member.birthDate)} años` : ''}</p><p>Fecha de alta: {member.joinedAt || 'Sin registrar'}</p><p>Contacto de emergencia: {member.emergencyContactName || 'Sin registrar'}</p><p>Teléfono de emergencia: {member.emergencyContactPhone || 'Sin registrar'}</p></section><section className="card"><h2>Estado del socio</h2><label>Estado<select value={member.status} onChange={e => commit({ ...data, members: data.members.map(item => item.id === member.id ? { ...item, status: e.target.value as Member['status'] } : item) })}><option>Activo</option><option>Inactivo</option><option>Pausado</option><option>Baja</option></select></label><p className="muted">El estado del socio es independiente de los pagos y rutinas.</p></section></div>
        <section className="card profile"><h2>Perfil de entrenamiento</h2><p>Objetivo: {member.goal || 'Sin registrar'}</p><p>Limitaciones o cuidados: {member.limitations || 'Sin registrar'}</p><p>Entrenador asignado: {member.trainer || 'Sin registrar'}</p><p>Observaciones administrativas: {member.notes || 'Ninguna'}</p></section>
        <div className="heading"><h2>Plan y pagos</h2><button onClick={() => { setMembershipForm({ planName: 'Mensual', startsAt: todayLocal(), price: '' }); setError(''); setPage('new-membership') }}>+ Asignar plan</button></div>
        {!currentMembership ? <div className="card empty">Todavía no hay un plan asignado a este socio.</div> : <section className="card profile">
          <div className="heading"><h2>{currentMembership.planName}</h2><span className={`badge ${daysUntil(currentMembership.endsAt, todayLocal())! < 0 ? 'danger' : daysUntil(currentMembership.endsAt, todayLocal())! <= 10 ? 'warning' : ''}`}>{dueLabel(currentMembership.endsAt)}</span></div>
          <p>Período: {currentMembership.startsAt} al {currentMembership.endsAt}</p><p>Precio: {money(currentMembership.price)}</p>
          <p>Pagado: {money(paidCents / 100)} · Saldo pendiente: <strong>{money(pendingCents / 100)}</strong></p>
          {pendingCents > 0 && <button onClick={() => { setPaymentForm({ paidAt: todayLocal(), amount: '', method: 'Efectivo' }); setError(''); setPage('new-payment') }}>+ Registrar pago</button>}
          <h3>Pagos de este plan</h3>{membershipPayments.length === 0 ? <p className="muted">Todavía no hay pagos registrados.</p> : membershipPayments.map(item => <p key={item.id}>{item.paidAt} · {item.method} · {money(item.amount)}</p>)}
        </section>}
        {memberships.length > 1 && <section className="card profile"><h2>Planes anteriores</h2>{memberships.slice(1).map(item => <p key={item.id}>{item.planName}: {item.startsAt} al {item.endsAt} · {money(item.price)} · pagado {money(data.payments.filter(payment => payment.membershipId === item.id).reduce((sum, payment) => sum + cents(payment.amount), 0) / 100)}</p>)}</section>}
        <div className="heading"><h2>Entrenamiento y rutinas</h2><button onClick={startRoutine}>+ Crear rutina</button></div>
        {memberRoutines.length === 0 ? <div className="card empty">Todavía no hay rutinas asignadas.</div> : <div className="list">{memberRoutines.map((item, index) => <button key={item.id} className="list-item" onClick={() => { setRoutineId(item.id); setViewBlock(1); setPage('routine') }}><span><strong>{item.name}</strong><small>{item.daysPerWeek} días por semana · {new Date(item.createdAt).toLocaleDateString('es-UY')} · {index === 0 ? 'Actual' : 'Historial'}</small></span><span aria-hidden="true">→</span></button>)}</div>}
        {currentRoutine && nextRoutineDay && <section className="card next-session"><div><p className="eyebrow">PRÓXIMO ENTRENAMIENTO</p><h2>Día {nextRoutineDay} · {currentRoutine.name}</h2><p className="muted">{lastRoutineSession ? `Último entrenamiento registrado: Día ${lastRoutineSession.day} · ${lastRoutineSession.performedAt}` : 'Todavía no hay días registrados de esta rutina. Se empieza por el Día 1.'}</p><p className="student-progress">{programProgress}</p>{currentBlock > 1 && !currentRoutine.blockExercises?.[currentBlock] && !currentRoutine.weekExercises?.[currentBlock] && <p className="muted">Bloque sin personalizar: se mantiene la última planificación disponible.</p>}<p className="muted">{programFinished ? 'Programa completado. Revisá el siguiente programa con el entrenador.' : 'Una semana se completa al registrar todos los días de la rutina en orden. La fecha por sí sola no cambia la semana.'}</p></div>{!programFinished && <button onClick={() => { setSessionForm({ performedAt: todayLocal(), routineId: currentRoutine.id, day: String(nextRoutineDay), notes: '' }); setSessionResults(dayExercises(currentRoutine, nextRoutineDay, currentBlock, currentWeek).map(ex => ({ exerciseId: ex.id, name: ex.name, sets: '', reps: '', load: '', rir: '' }))); setError(''); setPage('new-session') }}>Registrar Día {nextRoutineDay}</button>}</section>}
        <div className="heading session-heading"><h2>Entrenamientos realizados</h2><button onClick={() => { setSessionForm({ performedAt: todayLocal(), routineId: '', day: '', notes: '' }); setSessionResults([]); setError(''); setPage('new-session') }}>+ Registrar entrenamiento</button></div>
        {memberSessions.length === 0 ? <div className="card empty">Todavía no hay entrenamientos registrados.</div> : <div className="list">{memberSessions.map(item => <div className="card session-item" key={item.id}><div><strong>{item.performedAt}</strong><p className="muted">{item.routineName || 'Sin rutina'}{item.day ? ` · Día ${item.day}` : ''}{item.block ? ` · Bloque ${item.block}` : ''}{item.week ? ` · Semana ${item.week}` : ''}</p>{item.results?.map(result => <p className="session-result" key={result.exerciseId}><strong>{result.name}:</strong> {result.sets || '—'} series · {result.reps || '—'} repeticiones · Carga {result.load || '—'} · RIR {result.rir || '—'}</p>)}{item.notes && <p>{item.notes}</p>}{item.review ? <p className="session-review"><strong>Revisado por {item.review.trainer} · {item.review.reviewedAt}</strong>{item.review.notes && <span>{item.review.notes}</span>}</p> : <p className="muted">Pendiente de revisión del entrenador.</p>}{reviewingSessionId === item.id && <form className="session-review-form" onSubmit={event => saveReview(event, item)}><label>Entrenador *<input required maxLength={120} value={reviewForm.trainer} onChange={event => setReviewForm({ ...reviewForm, trainer: event.target.value })}/></label><label>Comentarios de la revisión<textarea maxLength={4000} value={reviewForm.notes} onChange={event => setReviewForm({ ...reviewForm, notes: event.target.value })}/></label><div className="actions"><button type="submit">Guardar revisión</button><button type="button" className="secondary" onClick={() => setReviewingSessionId(null)}>Cancelar</button></div></form>}</div><div className="session-actions"><button type="button" className="text-button" onClick={() => reviewingSessionId === item.id ? setReviewingSessionId(null) : startReview(item)}>{item.review ? 'Editar revisión' : 'Revisar'}</button><button type="button" className="text-button" onClick={() => deleteSession(item)}>Eliminar</button></div></div>)}</div>}
      </>}
      {page === 'new-session' && member && <>
        <p className="eyebrow">ENTRENAMIENTO · {member.firstName} {member.lastName}</p><h1>Registrar entrenamiento</h1>
        <form className="card form" onSubmit={addSession}>
          <div className="grid">
            <label>Fecha *<input type="date" required max={todayLocal()} value={sessionForm.performedAt} onChange={e => setSessionForm({ ...sessionForm, performedAt: e.target.value })}/></label>
            <label>Rutina<select value={sessionForm.routineId} onChange={e => { setSessionForm({ ...sessionForm, routineId: e.target.value, day: '' }); setSessionResults([]) }}><option value="">Sin rutina</option>{memberRoutines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            {selectedSessionRoutine && <label>Día de la rutina<select value={sessionForm.day} onChange={e => { const day = e.target.value; setSessionForm({ ...sessionForm, day }); setSessionResults(dayExercises(selectedSessionRoutine, Number(day), sessionBlock, sessionWeek).map(ex => ({ exerciseId: ex.id, name: ex.name, sets: '', reps: '', load: '', rir: '' }))) }}><option value="">Sin especificar</option>{Array.from({ length: selectedSessionRoutine.daysPerWeek }, (_, index) => index + 1).map(day => <option key={day} value={day}>Día {day}</option>)}</select></label>}
          </div>
          {sessionDayExercises.length > 0 && <section className="session-exercises"><h2>Resultados por ejercicio · Bloque {sessionBlock} · Semana {sessionWeek}</h2><p className="muted">Cargá lo que se hizo realmente. Podés dejar ejercicios sin completar.</p>{sessionDayExercises.map(ex => { const result = sessionResults.find(item => item.exerciseId === ex.id); const previous = memberSessions.filter(item => item.performedAt <= sessionForm.performedAt).flatMap(item => item.results || []).find(item => item.exerciseId === ex.id || searchable(item.name) === searchable(ex.name)); return <div key={ex.id} className="session-exercise"><strong>{ex.name}</strong><small>Planificado: {ex.sets || '—'} series · {ex.reps || '—'} repeticiones · Carga {ex.load || '—'} · RIR {ex.rir || '—'}</small>{previous && <small>Anterior: {previous.sets || '—'} series · {previous.reps || '—'} repeticiones · Carga {previous.load || '—'} · RIR {previous.rir || '—'}</small>}<div className="grid">{(['sets', 'reps', 'load', 'rir'] as const).map(key => <label key={key}>{({ sets: 'Series realizadas', reps: 'Repeticiones realizadas', load: 'Carga utilizada', rir: 'RIR real' })[key]}<input maxLength={60} value={result?.[key] || ''} onChange={event => setSessionResults(current => current.map(item => item.exerciseId === ex.id ? { ...item, [key]: event.target.value } : item))}/></label>)}</div></div> })}</section>}
          {selectedSessionRoutine && sessionForm.day && dayGuidance(selectedSessionRoutine, Number(sessionForm.day), sessionBlock, sessionWeek) && <div className="session-guidance"><strong>Indicaciones para este día</strong><p>{dayGuidance(selectedSessionRoutine, Number(sessionForm.day), sessionBlock, sessionWeek)}</p></div>}
          {selectedSessionRoutine && sessionForm.day && <SessionComponents items={dayComponents(selectedSessionRoutine, Number(sessionForm.day), sessionBlock, sessionWeek)}/>}
          <label>Observaciones<textarea placeholder="Por ejemplo: cómo se sintió, ejercicios realizados o cambios de carga" value={sessionForm.notes} onChange={e => setSessionForm({ ...sessionForm, notes: e.target.value })}/></label>
          <button type="submit">Guardar entrenamiento</button>
        </form>
      </>}
      {page === 'new-membership' && member && <><p className="eyebrow">PLAN · {member.firstName} {member.lastName}</p><h1>Asignar plan</h1><form className="card form" onSubmit={addMembership}>
        <div className="grid"><label>Plan *<select value={membershipForm.planName} onChange={e => setMembershipForm({ ...membershipForm, planName: e.target.value })}>{plans.map(plan => <option key={plan.name}>{plan.name}</option>)}</select></label>
        <label>Fecha de inicio *<input type="date" required value={membershipForm.startsAt} onChange={e => setMembershipForm({ ...membershipForm, startsAt: e.target.value })}/></label>
        <label>Precio total (pesos uruguayos) *<input type="number" min="0.01" step="0.01" required value={membershipForm.price} onChange={e => setMembershipForm({ ...membershipForm, price: e.target.value })}/></label></div>
        <p className="muted">Vence el {membershipEnd(membershipForm.startsAt, plans.find(plan => plan.name === membershipForm.planName)?.months || 1) || '—'}. Crear un plan nuevo no registra un pago.</p>
        <button type="submit">Guardar plan</button></form></>}
      {page === 'new-payment' && member && currentMembership && <><p className="eyebrow">PAGO · {member.firstName} {member.lastName}</p><h1>Registrar pago</h1><form className="card form" onSubmit={addPayment}>
        <p>Plan: {currentMembership.planName} · Saldo pendiente: {money(pendingCents / 100)}</p><div className="grid">
          <label>Fecha del pago *<input type="date" required value={paymentForm.paidAt} onChange={e => setPaymentForm({ ...paymentForm, paidAt: e.target.value })}/></label>
          <label>Importe (pesos uruguayos) *<input type="number" min="0.01" max={(pendingCents / 100).toFixed(2)} step="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}/></label>
          <label>Medio de pago<select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value as Payment['method'] })}><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></label></div>
        <button type="submit">Guardar pago</button></form></>}
      {(page === 'new-routine' || page === 'edit-routine') && member && <>
        <p className="eyebrow">ENTRENAMIENTO · {member.firstName} {member.lastName}</p><h1>{page === 'edit-routine' ? 'Editar rutina' : 'Crear rutina'}</h1>
        <form className="card form" onSubmit={saveRoutine}><div className="grid">
          <label>Nombre de la rutina *<input required value={routineForm.name} onChange={e => setRoutineForm({ ...routineForm, name: e.target.value })}/></label>
          <label>Objetivo<input value={routineForm.goal} onChange={e => setRoutineForm({ ...routineForm, goal: e.target.value })}/></label>
          <label>Nivel *<select required value={routineForm.level} onChange={e => setRoutineForm({ ...routineForm, level: e.target.value })}><option value="">Seleccionar</option><option>Principiante</option><option>Intermedio</option><option>Avanzado</option></select></label>
          <label>Días por semana<select value={routineForm.days} onChange={e => setRoutineForm({ ...routineForm, days: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n} {n === 1 ? 'día' : 'días'}</option>)}</select></label>
          <label>Vueltas del programa *<input type="number" required min="1" max="104" step="1" value={routineForm.programRounds} onChange={e => setRoutineForm({ ...routineForm, programRounds: Number(e.target.value) })}/></label>
          <label>Vueltas por bloque *<input type="number" required min="1" max={routineForm.programRounds} step="1" value={routineForm.blockRounds} onChange={e => setRoutineForm({ ...routineForm, blockRounds: Number(e.target.value) })}/></label>
        </div>
          <p className="muted">Cada bloque muestra todas sus semanas y cada semana muestra todos los días elegidos. Abrí un bloque para cargar o ajustar los ejercicios de cada día. Las semanas sin cambios usan la última planificación disponible.</p>
          {Array.from({ length: Math.ceil(Math.max(1, routineForm.programRounds) / Math.max(1, routineForm.blockRounds)) }, (_, index) => index + 1).map(block =>
            <details key={block} className="editor-block" open={block === 1}>
              <summary>Bloque {block} · semanas {(block - 1) * routineForm.blockRounds + 1}–{Math.min(block * routineForm.blockRounds, routineForm.programRounds)}{blockDetails[block]?.name ? ` · ${blockDetails[block].name}` : ''}</summary>
              <div className="block-fields">
                <label>Nombre del bloque<input maxLength={120} placeholder="Por ejemplo: Preparación" value={blockDetails[block]?.name || ''} onChange={e => updateBlockDetail(block, 'name', e.target.value)}/></label>
                <label>Calentamiento específico<textarea maxLength={4000} placeholder="Movilidad, activación y preparación antes de entrenar" value={blockDetails[block]?.warmup || ''} onChange={e => updateBlockDetail(block, 'warmup', e.target.value)}/></label>
              </div>
              {Array.from({ length: Math.max(0, Math.min(Math.max(1, routineForm.blockRounds), Math.max(1, routineForm.programRounds) - (block - 1) * Math.max(1, routineForm.blockRounds))) }, (_, index) => index + 1).map(week =>
                <section className="editor-week" key={week}>
                  <h2>Semana {(block - 1) * routineForm.blockRounds + week}</h2>
                  {Array.from({ length: routineForm.days }, (_, index) => index + 1).map(day => {
                    const planned = plannedEditorDay(block, week, day)
                    return <section className="day" key={day}>
                      <div className="heading"><h3>Día {day}</h3><button type="button" className="secondary" onClick={() => { setExerciseForm(blankExercise); setEditing({ block, week, day, id: null }) }}>+ Ejercicio</button></div>
                      {planned.length === 0 && <p className="muted">Sin ejercicios todavía.</p>}
                      {planned.map(ex => <div className="exercise" key={ex.id}><div><strong>{ex.name}</strong><small>{ex.sets || '–'} series · {ex.reps || '–'} repeticiones · RIR {ex.rir || '–'}</small></div><div className="actions"><button type="button" className="text-button" onClick={() => { setExerciseForm(ex); setEditing({ block, week, day, id: ex.id }) }}>Editar</button><button type="button" className="text-button" onClick={() => updateEditorExercises(block, week, day, planned.filter(item => item.id !== ex.id))}>Eliminar</button></div></div>)}
                      <label className="session-guidance-editor">Indicaciones opcionales para este día<textarea maxLength={4000} placeholder="Por ejemplo: activación, trabajo complementario o vuelta a la calma" value={plannedEditorGuidance(block, week, day)} onChange={e => updateSessionGuidance(block, week, day, e.target.value)}/></label>
                      <div className="heading component-heading"><h4>Componentes opcionales del día</h4><button type="button" className="secondary" onClick={() => { setComponentForm({ title: '', details: '' }); setComponentEditing({ block, week, day, id: null }) }}>+ Componente</button></div>
                      {plannedEditorComponents(block, week, day).map(item => <div className="exercise" key={item.id}><div><strong>{item.title}</strong><small>{item.details}</small></div><div className="actions"><button type="button" className="text-button" onClick={() => { setComponentForm({ title: item.title, details: item.details }); setComponentEditing({ block, week, day, id: item.id }) }}>Editar</button><button type="button" className="text-button" onClick={() => updateSessionComponents(block, week, day, plannedEditorComponents(block, week, day).filter(component => component.id !== item.id))}>Eliminar</button></div></div>)}
                    </section>
                  })}
                </section>)}
              <label className="block-objective">Objetivo y capacidades trabajadas en este bloque<textarea maxLength={4000} placeholder="Por ejemplo: fuerza, estabilidad y progresión al terminar la semana 4" value={blockDetails[block]?.objective || ''} onChange={e => updateBlockDetail(block, 'objective', e.target.value)}/></label>
            </details>)}
          <button type="submit">{page === 'edit-routine' ? 'Guardar cambios' : 'Guardar rutina'}</button>
        </form>
        {editing && <div className="overlay"><form className="card modal form" onSubmit={addExercise}><div className="heading"><h2>{editing.id ? 'Editar' : 'Agregar'} ejercicio · Bloque {editing.block} · Semana {(editing.block - 1) * routineForm.blockRounds + editing.week} · Día {editing.day}</h2><button type="button" className="text-button" onClick={() => setEditing(null)}>Cerrar</button></div><div className="grid">{(['name', 'sets', 'reps', 'load', 'rir', 'rest', 'tempo'] as const).map(key => <label key={key}>{({ name: 'Ejercicio *', sets: 'Series', reps: 'Repeticiones', load: 'Carga', rir: 'RIR', rest: 'Descanso', tempo: 'Tempo' })[key]}<input required={key === 'name'} value={exerciseForm[key]} onChange={e => setExerciseForm({ ...exerciseForm, [key]: e.target.value })}/></label>)}</div><label>Observaciones<textarea value={exerciseForm.notes} onChange={e => setExerciseForm({ ...exerciseForm, notes: e.target.value })}/></label><button type="submit">Guardar ejercicio</button></form></div>}
        {componentEditing && <div className="overlay"><form className="card modal form" onSubmit={saveComponent}><div className="heading"><h2>{componentEditing.id ? 'Editar' : 'Agregar'} componente · Bloque {componentEditing.block} · Semana {(componentEditing.block - 1) * routineForm.blockRounds + componentEditing.week} · Día {componentEditing.day}</h2><button type="button" className="text-button" onClick={() => setComponentEditing(null)}>Cerrar</button></div><label>Título *<input required maxLength={120} placeholder="Por ejemplo: Circuito de estabilidad" value={componentForm.title} onChange={e => setComponentForm({ ...componentForm, title: e.target.value })}/></label><label>Contenido *<textarea required maxLength={4000} placeholder="Explicá qué hacer, cuánto y en qué orden" value={componentForm.details} onChange={e => setComponentForm({ ...componentForm, details: e.target.value })}/></label><button type="submit">Guardar componente</button></form></div>}
      </>}
      {page === 'routine' && routine && <>
        <p className="eyebrow">RUTINA · {member?.firstName} {member?.lastName}</p><div className="heading"><h1>{routine.name}</h1><div className="actions"><button onClick={startEditRoutine}>Editar rutina</button><button className="secondary" onClick={deleteRoutine}>Eliminar rutina</button></div></div><p className="muted">{routine.goal || 'Sin objetivo registrado'} · {routine.level} · {routine.daysPerWeek} días por semana · {routine.programRounds ?? 24} vueltas · bloques de {routine.blockRounds ?? 4}</p>
        {data.members.some(item => item.id !== routine.memberId) && <form className="card copy-routine" onSubmit={copyRoutine}>
          <h2>Copiar a otro socio</h2><p className="muted">Se crea una rutina independiente. La original queda en la ficha de este socio.</p>
          <div className="actions"><label>Socio de destino<select required value={copyTargetId} onChange={event => setCopyTargetId(event.target.value)}><option value="">Seleccionar socio</option>{data.members.filter(item => item.id !== routine.memberId).map(item => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select></label><button type="submit" className="secondary">Copiar rutina</button></div>
        </form>}
        <label>Ver bloque<select value={Math.min(viewBlock, Math.ceil((routine.programRounds ?? 24) / (routine.blockRounds ?? 4)))} onChange={e => setViewBlock(Number(e.target.value))}>{Array.from({ length: Math.ceil((routine.programRounds ?? 24) / (routine.blockRounds ?? 4)) }, (_, index) => <option key={index + 1} value={index + 1}>Bloque {index + 1} · vueltas {index * (routine.blockRounds ?? 4) + 1}–{Math.min((index + 1) * (routine.blockRounds ?? 4), routine.programRounds ?? 24)}</option>)}</select></label>
        {routine.blockDetails?.[viewBlock]?.name && <h2 className="block-detail-title">{routine.blockDetails[viewBlock].name}</h2>}
        {routine.blockDetails?.[viewBlock]?.warmup && <section className="card block-note"><h3>Calentamiento específico del bloque</h3><p>{routine.blockDetails[viewBlock].warmup}</p></section>}
        {viewBlock > 1 && !routine.blockExercises?.[viewBlock] && !routine.weekExercises?.[viewBlock] && <p className="muted">Este bloque aún no está personalizado: se mantiene la última planificación disponible. Usá «Editar rutina» para ajustarlo.</p>}
        {Array.from({ length: Math.min(routine.blockRounds ?? 4, (routine.programRounds ?? 24) - (viewBlock - 1) * (routine.blockRounds ?? 4)) }, (_, index) => index + 1).map(week =>
          <section className="program-week" key={week}>
            <h2>Bloque {viewBlock} · Semana {(viewBlock - 1) * (routine.blockRounds ?? 4) + week}</h2>
            {week > 1 && !routine.weekExercises?.[viewBlock]?.[week] && <p className="muted">Se mantiene la última planificación disponible.</p>}
            {Array.from({ length: routine.daysPerWeek }, (_, index) => index + 1).map(day =>
              <section className="card routine-day" key={day}><h3>Día {day}</h3>
                {dayExercises(routine, day, viewBlock, week).length === 0 ? <p className="muted">Sin ejercicios.</p> :
                  dayExercises(routine, day, viewBlock, week).map(ex => <div className="exercise" key={ex.id}><div><strong>{ex.name}</strong><small>{ex.sets || '–'} series · {ex.reps || '–'} repeticiones · Carga {ex.load || '–'} · RIR {ex.rir || '–'} · Descanso {ex.rest || '–'}{ex.tempo ? ` · Tempo ${ex.tempo}` : ''}</small>{ex.notes && <small>Observaciones: {ex.notes}</small>}</div></div>)}
                {dayGuidance(routine, day, viewBlock, week) && <div className="session-guidance"><strong>Indicaciones para este día</strong><p>{dayGuidance(routine, day, viewBlock, week)}</p></div>}
                <SessionComponents items={dayComponents(routine, day, viewBlock, week)}/>
              </section>)}
          </section>)}
        {routine.blockDetails?.[viewBlock]?.objective && <section className="card block-note"><h3>Objetivo y capacidades del bloque</h3><p>{routine.blockDetails[viewBlock].objective}</p></section>}
      </>}
      </>}
      <div className={access === 'admin' ? 'cloud-admin-entry' : 'cloud-entry'} hidden={access === 'admin' && page !== 'home'}>
        <CloudAccount onAccessChange={setAccess} onExportLocal={exportData} hasLocalData={Boolean(data.members.length || data.routines.length || data.sessions.length || data.payments.length)}/>
      </div>
    </main>
  </div>
}
export default App
