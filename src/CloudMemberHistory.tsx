import { planCatalog } from './planCatalog'
import { readAllPages } from './readAllPages'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Exercise } from './data'
import { daysUntil, membershipEnd, parseDay } from './membership'
import CloudRoutineEditor from './CloudRoutineEditor'
import CloudSessionRecorder from './CloudSessionRecorder'
import { trainingProgress, type CloudRoutine, type CloudSession } from './cloudTraining'

type RoutinePlan = CloudRoutine['plan']
type RoutineRow = CloudRoutine
type MembershipRow = { id: string; plan_name: string; starts_at: string; ends_at: string; price: number; months: number; service_extras: string[]; service_details: string }
type PaymentRow = { id: string; membership_id: string; paid_at: string; amount: number; method: string }
type SessionRow = CloudSession
type ReviewRow = { session_id: string; trainer_name: string; trainer_user_id: string | null; notes: string; reviewed_at: string }
type History = { routines: RoutineRow[]; memberships: MembershipRow[]; payments: PaymentRow[]; sessions: SessionRow[]; reviews: ReviewRow[] }
type ExercisePath = { source: 'exercisesByDay' | 'blockExercises' | 'weekExercises'; day: string; block?: string; week?: string }

const money = (amount: number) => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(amount)
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
const planOptions = planCatalog
const cents = (value: number) => Math.round(Number(value) * 100)
const amountInCents = (input: string) => /^\d+(?:\.\d{1,2})?$/.test(input.trim()) ? cents(Number(input)) : NaN
const dueLabel = (end: string) => { const days = daysUntil(end, today()); return days === null ? 'Fecha inválida' : days < 0 ? `Vencido hace ${-days} día${days === -1 ? '' : 's'}` : days === 0 ? 'Vence hoy' : days <= 10 ? `Vence en ${days} días` : 'Al día' }
const readableDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}
const sorted = (record: Record<string, unknown>) => Object.keys(record).sort((a, b) => Number(a) - Number(b))
const exercises = (items: Exercise[], path: ExercisePath, onEdit: (item: Exercise, path: ExercisePath) => void) => items.length ? <ul>{items.map(item =>
  <li key={item.id}><strong>{item.name}</strong> · {item.sets} series · {item.reps} repeticiones
    {item.load && ` · Carga ${item.load}`}{item.rir && ` · RIR ${item.rir}`}{item.rest && ` · Descanso ${item.rest}`}{item.tempo && ` · Tempo ${item.tempo}`}
    {item.notes && <p>{item.notes}</p>} <button type="button" className="text-button" onClick={() => onEdit(item, path)}>Editar series y repeticiones</button></li>)}</ul> : <p className="muted">Sin ejercicios.</p>

function RoutinePlanning({ plan, onEdit }: { plan: RoutinePlan; onEdit: (item: Exercise, path: ExercisePath) => void }) {
  const base = plan.exercisesByDay ?? {}
  const blocks = plan.blockExercises ?? {}
  const weeks = plan.weekExercises ?? {}
  return <details><summary>Ver planificación guardada</summary>
    <p className="muted">Los días sin cambios propios mantienen la última planificación disponible.</p>
    {sorted(base).map(day => <div key={day}><h5>Plan inicial · Día {day}</h5>{exercises(base[day], { source: 'exercisesByDay', day }, onEdit)}</div>)}
    {sorted(blocks).map(block => <div key={block}><h5>Bloque {block} · Ajustes generales</h5>
      {sorted(blocks[block]).map(day => <div key={day}><strong>Día {day}</strong>{exercises(blocks[block][day], { source: 'blockExercises', block, day }, onEdit)}</div>)}</div>)}
    {sorted(weeks).map(block => <div key={block}><h5>Bloque {block}</h5>
      {sorted(weeks[block]).map(week => <div key={week}><strong>Semana {week}</strong>
        {sorted(weeks[block][week]).map(day => <div key={day}><strong>Día {day}</strong>{exercises(weeks[block][week][day], { source: 'weekExercises', block, week, day }, onEdit)}</div>)}</div>)}</div>)}
    {sorted(plan.blockDetails ?? {}).map(block => { const detail = plan.blockDetails![block]; return <div key={block}><h5>Indicaciones del bloque {block}{detail.name ? ` · ${detail.name}` : ''}</h5>
      {detail.warmup && <p><strong>Calentamiento:</strong> {detail.warmup}</p>}{detail.objective && <p><strong>Objetivo:</strong> {detail.objective}</p>}</div> })}
    {sorted(plan.sessionGuidance ?? {}).map(block => sorted(plan.sessionGuidance![block]).map(week => sorted(plan.sessionGuidance![block][week]).map(day =>
      <p key={`${block}-${week}-${day}`}><strong>Bloque {block} · Semana {week} · Día {day}:</strong> {plan.sessionGuidance![block][week][day]}</p>)))}
    {sorted(plan.sessionComponents ?? {}).map(block => sorted(plan.sessionComponents![block]).map(week => sorted(plan.sessionComponents![block][week]).map(day =>
      <div key={`${block}-${week}-${day}`}><h5>Componentes · Bloque {block} · Semana {week} · Día {day}</h5>
        {plan.sessionComponents![block][week][day].map((part, index) => <p key={index}><strong>{part.title}:</strong> {part.details}</p>)}</div>)))}
  </details>
}

export default function CloudMemberHistory({ client, memberId, memberName, assignedTrainer, memberOptions, onClose, onChanged, children }: {
  client: SupabaseClient; memberId: string; memberName: string; assignedTrainer: string; memberOptions: { id: string; name: string }[]; onClose: () => void; onChanged: () => void; children?: ReactNode
}) {
  const [history, setHistory] = useState<History | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ routine: RoutineRow; exercise: Exercise; path: ExercisePath } | null>(null)
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const paymentBusy = useRef(false)
  const [paymentRequestId, setPaymentRequestId] = useState(() => crypto.randomUUID())
  const [activeForm, setActiveForm] = useState<'plan' | 'payment' | null>(null)
  const [routineEditor, setRoutineEditor] = useState<RoutineRow | 'new' | null>(null)
  const [copySourceId, setCopySourceId] = useState('')
  const [copyTargetId, setCopyTargetId] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewForm, setReviewForm] = useState({ trainerName: '', notes: '' })
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [deletingRoutineId, setDeletingRoutineId] = useState<string | null>(null)
  const [recording, setRecording] = useState<'suggested' | 'manual' | null>(null)
  const [planForm, setPlanForm] = useState({ planName: planCatalog[0].name, startsAt: today(), price: String(planCatalog[0].price), extras: [] as string[], details: '' })
  const [paymentForm, setPaymentForm] = useState({ paidAt: today(), amount: '', method: 'Efectivo' })
  useEffect(() => {
    let active = true
    const fetchHistory = async () => {
      setHistory(null); setError(''); setEditing(null)
      const [routines, memberships, payments, sessions, reviews] = await Promise.all([
        readAllPages((from, to) => client.from('routines').select('id,name,goal,level,days_per_week,program_rounds,block_rounds,plan', { count: 'exact' }).eq('member_id', memberId).order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to)),
        readAllPages((from, to) => client.from('memberships').select('id,plan_name,months,starts_at,ends_at,price,service_extras,service_details', { count: 'exact' }).eq('member_id', memberId).order('starts_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
        readAllPages((from, to) => client.from('payments').select('id,membership_id,paid_at,amount,method', { count: 'exact' }).eq('member_id', memberId).order('paid_at', { ascending: false }).order('id', { ascending: true }).range(from, to)),
        readAllPages((from, to) => client.from('sessions').select('id,performed_at,routine_id,routine_name,day,block,week,notes,results,created_at', { count: 'exact' }).eq('member_id', memberId).order('performed_at', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to)),
        readAllPages((from, to) => client.from('session_reviews').select('session_id,trainer_name,trainer_user_id,notes,reviewed_at', { count: 'exact' }).eq('member_id', memberId).order('session_id', { ascending: true }).range(from, to)),
      ])
      if (!active) return
      if ([routines, memberships, payments, sessions, reviews].some(result => result.error)) {
        setError('No se pudo cargar el historial completo. Revisá la conexión y los permisos.'); return
      }
      setHistory({ routines: routines.data as RoutineRow[], memberships: memberships.data as MembershipRow[],
        payments: payments.data as PaymentRow[], sessions: sessions.data as SessionRow[], reviews: reviews.data as ReviewRow[] })
    }
    void fetchHistory()
    return () => { active = false }
  }, [client, memberId, revision])

  const currentPlan = history?.memberships[0]
  const received = history?.payments.filter(payment => payment.membership_id === currentPlan?.id)
    .reduce((sum, payment) => sum + cents(payment.amount), 0) ?? 0
  const pending = currentPlan ? Math.max(0, cents(currentPlan.price) - received) : 0
  const selectedPlan = planOptions.find(option => option.name === planForm.planName)
  const endsAt = membershipEnd(planForm.startsAt, selectedPlan?.months ?? 1)
  const currentRoutine = history?.routines[0]
  const progress = currentRoutine && history ? trainingProgress(currentRoutine, history.routines, history.sessions, today()) : null

  async function copyToMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const source = history?.routines.find(item => item.id === (copySourceId || currentRoutine?.id))
    const destination = memberOptions.find(item => item.id === copyTargetId && item.id !== memberId)
    if (!source || !destination) { setError('Elegí la rutina y otro socio para recibir la copia.'); return }
    setSaving(true); setError(''); setMessage('')
    const { data: latest, error: readError } = await client.from('routines')
      .select('name,goal,level,days_per_week,program_rounds,block_rounds,plan')
      .eq('id', source.id).eq('member_id', memberId).single()
    if (readError || !latest) { setSaving(false); setError('No se pudo consultar la rutina original. Intentá actualizar la ficha.'); return }
    const plan = structuredClone(latest.plan) as RoutinePlan
    for (const exercises of Object.values(plan.exercisesByDay ?? {})) for (const exercise of exercises) exercise.id = crypto.randomUUID()
    for (const block of Object.values(plan.blockExercises ?? {})) for (const exercises of Object.values(block)) for (const exercise of exercises) exercise.id = crypto.randomUUID()
    for (const block of Object.values(plan.weekExercises ?? {})) for (const week of Object.values(block)) for (const exercises of Object.values(week)) for (const exercise of exercises) exercise.id = crypto.randomUUID()
    for (const block of Object.values(plan.sessionComponents ?? {})) for (const week of Object.values(block)) for (const components of Object.values(week)) for (const component of components) component.id = crypto.randomUUID()
    const { error: writeError } = await client.from('routines').insert({ ...latest, plan, id: crypto.randomUUID(), member_id: destination.id })
    setSaving(false)
    if (writeError) { setError('No se pudo copiar la rutina. No se modificó la original. Revisá la conexión y los permisos.'); return }
    setCopyTargetId('')
    setMessage(`La rutina «${latest.name}» se copió a ${destination.name}. La original sigue en la ficha de ${memberName}.`)
    onChanged()
  }

  function openReview(sessionId: string, current?: ReviewRow) {
    setReviewingId(sessionId)
    setReviewForm({ trainerName: current?.trainer_name || assignedTrainer, notes: current?.notes || '' })
    setError(''); setMessage('')
  }

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reviewingId || saving || deletingSessionId) return
    const trainerName = reviewForm.trainerName.trim()
    const notes = reviewForm.notes.trim()
    if (!trainerName || trainerName.length > 120 || notes.length > 4000 || !history?.sessions.some(session => session.id === reviewingId)) {
      setError('Revisá el entrenador y el comentario.'); return
    }
    setSaving(true); setError(''); setMessage('')
    const previous = history.reviews.find(item => item.session_id === reviewingId)
    const row = { session_id: reviewingId, member_id: memberId, trainer_user_id: previous?.trainer_user_id ?? null,
      trainer_name: trainerName, notes, reviewed_at: today() }
    const { data, error: writeError } = await client.from('session_reviews').upsert(row, { onConflict: 'session_id' })
      .select('session_id,trainer_name,trainer_user_id,notes,reviewed_at').single()
    setSaving(false)
    if (writeError || !data) { setError('No se pudo guardar la revisión. No se modificó el entrenamiento.'); return }
    setHistory(current => current && ({ ...current, reviews: [...current.reviews.filter(item => item.session_id !== data.session_id), data as ReviewRow] }))
    setReviewingId(null)
    setMessage('Revisión guardada. El alumno verá el comentario en su portal al actualizarlo.')
  }

  async function deleteSession(session: SessionRow) {
    if (saving || deletingSessionId || !history?.sessions.some(item => item.id === session.id)) return
    if (!window.confirm(`¿Eliminar el entrenamiento del ${readableDate(session.performed_at)} de ${memberName}? Se borrarán sus resultados y su revisión. Esto puede cambiar el próximo día del alumno. Esta acción no se puede deshacer.`)) return
    setDeletingSessionId(session.id); setError(''); setMessage('')
    const { data, error: deleteError } = await client.from('sessions').delete().eq('id', session.id).eq('member_id', memberId).select('id').maybeSingle()
    setDeletingSessionId(null)
    if (deleteError || !data) { setError('No se pudo eliminar el entrenamiento. Actualizá la ficha y volvé a intentarlo.'); return }
    setHistory(current => current && ({ ...current, sessions: current.sessions.filter(item => item.id !== session.id),
      reviews: current.reviews.filter(item => item.session_id !== session.id) }))
    if (reviewingId === session.id) setReviewingId(null)
    setMessage('Entrenamiento eliminado. El próximo día se recalculó desde los registros restantes.')
    onChanged()
  }

  async function deleteRoutine(routine: RoutineRow) {
    if (saving || deletingRoutineId || deletingSessionId || !history?.routines.some(item => item.id === routine.id)) return
    if (history.sessions.some(item => item.routine_id === routine.id)) {
      setError('Esta rutina tiene entrenamientos registrados. Para conservar el historial y el próximo día del alumno, no se puede eliminar. Podés editarla o crear otra.'); return
    }
    if (!window.confirm(`¿Eliminar la rutina «${routine.name}» de ${memberName}? La planificación se borrará y, si es la rutina actual, el alumno pasará a la anterior. Esta acción no se puede deshacer.`)) return
    setDeletingRoutineId(routine.id); setError(''); setMessage('')
    // Refresh the association before deleting; do not depend on a potentially stale local list.
    const { data: linked, error: readError } = await client.from('sessions').select('id').eq('member_id', memberId).eq('routine_id', routine.id).limit(1)
    if (readError || !linked) {
      setDeletingRoutineId(null); setError('No se pudo comprobar el historial de esta rutina. Actualizá la ficha y volvé a intentarlo.'); return
    }
    if (linked.length) {
      setDeletingRoutineId(null); setError('Se registró un entrenamiento con esta rutina. Actualizá la ficha antes de continuar.'); setRevision(value => value + 1); return
    }
    const { data, error: deleteError } = await client.from('routines').delete().eq('id', routine.id).eq('member_id', memberId).select('id').maybeSingle()
    setDeletingRoutineId(null)
    if (deleteError || !data) { setError('No se pudo eliminar la rutina. Actualizá la ficha y volvé a intentarlo.'); return }
    setHistory(current => current && ({ ...current, routines: current.routines.filter(item => item.id !== routine.id) }))
    if (routineEditor !== 'new' && routineEditor?.id === routine.id) setRoutineEditor(null)
    if (copySourceId === routine.id) setCopySourceId('')
    setRecording(null)
    setMessage('Rutina eliminada. La ficha y el portal del alumno mostrarán la rutina anterior, si existe.')
    onChanged()
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const price = amountInCents(planForm.price)
    if (saving) return
    if (!selectedPlan || !endsAt || !Number.isSafeInteger(price) || price <= 0 || price > 999999999999) {
      setError('Revisá el plan, la fecha y el precio. Escribí hasta dos decimales usando punto.'); return
    }
    setSaving(true); setError(''); setMessage('')
    const { error: writeError } = await client.from('memberships').insert({ id: crypto.randomUUID(), member_id: memberId,
      plan_name: [selectedPlan.name,...planForm.extras].join(' + '), service_extras: planForm.extras, service_details: planForm.details.trim(), months: selectedPlan.months, starts_at: planForm.startsAt, ends_at: endsAt, price: price / 100 })
    setSaving(false)
    if (writeError) { setError('No se pudo guardar el plan en Supabase. Revisá la conexión y los permisos.'); return }
    setActiveForm(null); setMessage('Plan guardado en Supabase. No se registró ningún pago.'); setRevision(value => value + 1)
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentPlan || saving || paymentBusy.current) return
    const amount = amountInCents(paymentForm.amount)
    if (!parseDay(paymentForm.paidAt) || paymentForm.paidAt > today() || !Number.isSafeInteger(amount) || amount <= 0 || amount > pending) {
      setError('Ingresá una fecha válida y un importe mayor a cero que no supere el saldo pendiente. Usá punto para los decimales.'); return
    }
    paymentBusy.current = true
    setSaving(true); setError(''); setMessage('')
    try {
      const { data, error: writeError } = await client.rpc('register_payment', {
        p_request_id: paymentRequestId, p_member_id: memberId, p_membership_id: currentPlan.id,
        p_paid_at: paymentForm.paidAt, p_amount_cents: amount, p_method: paymentForm.method,
      })
      if (writeError || !data) {
        setError(writeError?.code === 'PGRST202' || writeError?.code === '42883'
          ? 'Falta activar la protección de pagos en la base. Contactá al administrador.'
          : 'No se pudo confirmar el pago. Revisá el historial y el saldo antes de cambiar los datos o abrir otro formulario. Podés reintentar este mismo envío.'); return
      }
      setActiveForm(null); setMessage('Pago guardado en Supabase.'); setRevision(value => value + 1)
    } catch {
      setError('Se interrumpió la conexión. Reintentá desde este formulario con los mismos datos; se verificará si el pago ya quedó guardado.')
    } finally { paymentBusy.current = false; setSaving(false) }
  }

  function startEdit(routine: RoutineRow, exercise: Exercise, path: ExercisePath) {
    setEditing({ routine, exercise, path })
    setSets(exercise.sets ?? '')
    setReps(exercise.reps ?? '')
    setError(''); setMessage('')
  }

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || saving) return
    const newSets = sets.trim(); const newReps = reps.trim()
    if (!newSets || !newReps || newSets.length > 60 || newReps.length > 60) {
      setError('Completá series y repeticiones (hasta 60 caracteres cada uno).'); return
    }
    const { routine, exercise, path } = editing
    // Copy the entire plan, preserving guidance and any fields the editor does not display.
    const plan = structuredClone(routine.plan)
    const items = path.source === 'exercisesByDay' ? plan.exercisesByDay?.[path.day] :
      path.source === 'blockExercises' ? plan.blockExercises?.[path.block!]?.[path.day] :
        plan.weekExercises?.[path.block!]?.[path.week!]?.[path.day]
    const index = items?.findIndex(item => item.id === exercise.id) ?? -1
    if (!items || index === -1) { setError('El ejercicio ya no está en esta planificación. Actualizá el historial.'); return }
    items[index] = { ...items[index], sets: newSets, reps: newReps }
    setSaving(true); setError(''); setMessage('')
    // Compare the original JSONB value so another editor's changes cannot be overwritten.
    const result = await client.from('routines').update({ plan }).eq('id', routine.id).eq('member_id', memberId)
      .eq('plan', JSON.stringify(routine.plan)).select('id').maybeSingle()
    setSaving(false)
    if (result.error) { setError('No se pudo guardar el ejercicio. Revisá la conexión y los permisos.'); return }
    if (!result.data) { setError('La rutina cambió en otra sesión. Cerrá y volvé a abrir el historial antes de editar.'); return }
    setHistory(current => current && ({ ...current, routines: current.routines.map(item => item.id === routine.id ? { ...item, plan } : item) }))
    setEditing(null); setMessage('Series y repeticiones guardadas en Supabase.')
  }

  return <div className="cloud-history" aria-label={`Historial de ${memberName}`}>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {editing && <div className="overlay"><form className="card modal form cloud-member-form" role="dialog" aria-modal="true" aria-label="Corregir ejercicio" onSubmit={event => void saveExercise(event)}>
      <h4>Editar {editing.exercise.name} · {editing.routine.name}</h4>
      <p className="muted">Comprobá los valores correctos antes de guardarlos; el cambio afecta la planificación de este socio.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="grid"><label>Series *<input required maxLength={60} value={sets} onChange={event => setSets(event.target.value)}/></label>
        <label>Repeticiones *<input required maxLength={60} value={reps} onChange={event => setReps(event.target.value)}/></label></div>
      <div className="actions"><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar corrección'}</button>
        <button type="button" className="secondary" disabled={saving} onClick={() => { setEditing(null); setError('') }}>Cancelar</button></div>
    </form></div>}
    {!error && !history && <p role="status">Cargando historial de Supabase…</p>}
    {history && <>
      <div className="heading"><h2>Plan y pagos</h2><button type="button" disabled={saving} onClick={() => { setActiveForm('plan'); setError(''); setMessage(''); setPlanForm({ planName: planCatalog[0].name, startsAt: today(), price: String(planCatalog[0].price), extras: [], details: '' }) }}>+ Asignar plan</button></div>
      {activeForm === 'plan' && <form className="card form" onSubmit={event => void savePlan(event)}><fieldset disabled={saving} className="plain-fieldset">
        <h2>Asignar plan</h2><div className="grid"><label>Plan *<select value={planForm.planName} onChange={event => setPlanForm({ ...planForm, planName: event.target.value, price: String(planCatalog.find(plan => plan.name === event.target.value)!.price) })}>{planOptions.map(option => <option key={option.name}>{option.name}</option>)}</select></label>
          <label>Fecha de inicio *<input type="date" required value={planForm.startsAt} onChange={event => setPlanForm({ ...planForm, startsAt: event.target.value })}/></label>
          <label>Precio total (pesos uruguayos) *<input type="number" min="0.01" step="0.01" required value={planForm.price} onChange={event => setPlanForm({ ...planForm, price: event.target.value })}/></label></div>
        <p className="muted">Importe base calculado por la duración completa, sin descuento. Podés ajustar el total si acordás complementos.</p><fieldset className="plan-extras"><legend>Complementos opcionales</legend>{['Kinesiología','Nutrición'].map(extra=><label key={extra} className="exercise-check"><input type="checkbox" checked={planForm.extras.includes(extra)} onChange={e=>setPlanForm({...planForm,extras:e.target.checked?[...planForm.extras,extra]:planForm.extras.filter(x=>x!==extra)})}/>+ {extra}</label>)}</fieldset><label>Qué incluye el plan y sus complementos<textarea maxLength={1000} value={planForm.details} onChange={e=>setPlanForm({...planForm,details:e.target.value})}/></label><p className="muted">El precio es el total acordado, incluidos los complementos. El acceso a Nutrición se habilita desde las solicitudes del panel.</p>
        <p className="muted">Vence el {endsAt ? readableDate(endsAt) : '—'}. Crear un plan nuevo no registra un pago.</p>
        <div className="actions"><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar plan'}</button><button type="button" className="secondary" disabled={saving} onClick={() => { setActiveForm(null); setError('') }}>Cancelar</button></div>
      </fieldset></form>}
      {!currentPlan ? <div className="card empty">Todavía no hay un plan asignado a este socio.</div> : <section className="card profile">
        <div className="heading"><h2>{currentPlan.plan_name}</h2><span className={`badge ${daysUntil(currentPlan.ends_at, today())! < 0 ? 'danger' : daysUntil(currentPlan.ends_at, today())! <= 10 ? 'warning' : ''}`}>{dueLabel(currentPlan.ends_at)}</span></div>
        {currentPlan.service_details&&<p>{currentPlan.service_details}</p>}<p>Duración: {currentPlan.months} {currentPlan.months === 1 ? 'mes' : 'meses'} · Inicio: {readableDate(currentPlan.starts_at)} · Vencimiento: {readableDate(currentPlan.ends_at)}</p><p>Precio: {money(currentPlan.price)}</p>
        <p>Pagado: {money(received / 100)} · Saldo pendiente: <strong>{money(pending / 100)}</strong></p>
        {pending > 0 && activeForm !== 'payment' && <button type="button" disabled={saving} onClick={() => { setPaymentRequestId(crypto.randomUUID()); setActiveForm('payment'); setPaymentForm({ paidAt: today(), amount: '', method: 'Efectivo' }); setError(''); setMessage('') }}>+ Registrar pago</button>}
        {activeForm === 'payment' && <form className="form cloud-payment-form" onSubmit={event => void savePayment(event)}>
          <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <h3>Registrar pago</h3><p>Plan: {currentPlan.plan_name} · Saldo pendiente: {money(pending / 100)}</p>
          <div className="grid"><label>Fecha del pago *<input type="date" required max={today()} value={paymentForm.paidAt} onChange={event => setPaymentForm({ ...paymentForm, paidAt: event.target.value })}/></label>
            <label>Importe (pesos uruguayos) *<input type="number" required min="0.01" max={(pending / 100).toFixed(2)} step="0.01" value={paymentForm.amount} onChange={event => setPaymentForm({ ...paymentForm, amount: event.target.value })}/></label>
            <label>Medio de pago<select value={paymentForm.method} onChange={event => setPaymentForm({ ...paymentForm, method: event.target.value })}><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></label></div>
          <div className="actions"><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar pago'}</button><button type="button" className="secondary" disabled={saving} onClick={() => { setActiveForm(null); setError('') }}>Cancelar</button></div>
                  </fieldset>
        </form>}
        <h3>Pagos de este plan</h3>{history.payments.filter(payment => payment.membership_id === currentPlan.id).length === 0 ? <p className="muted">Todavía no hay pagos registrados.</p> : history.payments.filter(payment => payment.membership_id === currentPlan.id).map(payment => <p key={payment.id}>{readableDate(payment.paid_at)} · {payment.method} · {money(payment.amount)}</p>)}
      </section>}
      {history.memberships.length > 1 && <section className="card profile"><h2>Planes anteriores</h2>{history.memberships.slice(1).map(plan => <p key={plan.id}>{plan.plan_name}: {readableDate(plan.starts_at)} al {readableDate(plan.ends_at)} · {money(plan.price)} · pagado {money(history.payments.filter(payment => payment.membership_id === plan.id).reduce((total, payment) => total + Number(payment.amount), 0))}</p>)}</section>}
    </>}
    {children}
    {history && <>
      <div className="heading session-heading"><h2>Entrenamiento y rutinas</h2><button type="button" onClick={() => { setRoutineEditor('new'); setRecording(null); setError(''); setMessage('') }}>+ Crear rutina</button></div>
      {history.routines.length > 0 && memberOptions.some(item => item.id !== memberId) && <form className="card copy-routine" onSubmit={event => void copyToMember(event)}>
        <h3>Copiar rutina a otro socio</h3><p className="muted">Se crea una rutina independiente para el socio elegido. La original queda en esta ficha.</p>
        <div className="actions"><label>Rutina<select required value={copySourceId || currentRoutine?.id || ''} onChange={event => setCopySourceId(event.target.value)}>
          {history.routines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Socio de destino<select required value={copyTargetId} onChange={event => setCopyTargetId(event.target.value)}><option value="">Seleccionar socio</option>
            {memberOptions.filter(item => item.id !== memberId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <button type="submit" className="secondary" disabled={saving}>{saving ? 'Copiando…' : 'Copiar rutina'}</button></div>
      </form>}
      {routineEditor && <CloudRoutineEditor key={routineEditor === 'new' ? 'new' : routineEditor.id}
        client={client} memberId={memberId} initial={routineEditor === 'new' ? undefined : routineEditor}
        onSaved={() => { setRoutineEditor(null); setMessage('Rutina guardada en Supabase.'); setRevision(value => value + 1) }}
        onCancel={() => setRoutineEditor(null)}/>} 
      <section className="card profile"><h3>Rutinas ({history.routines.length})</h3>
        {history.routines.length === 0 ? <p className="muted">Sin rutinas asignadas.</p> : history.routines.map(r => {
          const hasSessions = history.sessions.some(session => session.routine_id === r.id)
          return <article className="cloud-history-item" key={r.id}><strong>{r.name}</strong>
            <p>{r.goal} · {r.level} · {r.days_per_week} días por semana · {r.program_rounds} semanas · bloques de {r.block_rounds}</p>
            <div className="session-actions"><button type="button" className="secondary" disabled={Boolean(deletingRoutineId)} onClick={() => { setRoutineEditor(r); setRecording(null); setError(''); setMessage('') }}>Editar rutina</button>
              <button type="button" className="text-button delete-action" disabled={hasSessions || saving || Boolean(deletingRoutineId) || Boolean(deletingSessionId)} onClick={() => void deleteRoutine(r)}>{deletingRoutineId === r.id ? 'Eliminando…' : 'Eliminar rutina'}</button></div>
            {hasSessions && <p className="muted">Esta rutina tiene entrenamientos registrados y se conserva para proteger el historial.</p>}
            <RoutinePlanning plan={r.plan} onEdit={(exercise, path) => startEdit(r, exercise, path)}/>
          </article>
        })}</section>
      {currentRoutine && progress && <section className="card next-session"><div><p className="eyebrow">PRÓXIMO ENTRENAMIENTO</p>
        <h3>Día {progress.nextDay} · {currentRoutine.name}</h3>
        <p className="muted">{progress.last ? `Último día registrado: Día ${progress.last.day} · ${readableDate(progress.last.performed_at)}` : 'Todavía no hay días registrados. Se empieza por el Día 1.'}</p>
        <p>Semana {(progress.block - 1) * currentRoutine.block_rounds + progress.week} de {currentRoutine.program_rounds} · Bloque {progress.block} · {progress.completed} semanas completas</p>
        {progress.finished && <p className="muted">Programa completado. Revisá el siguiente programa con el entrenador.</p>}</div>
        {!progress.finished && <button type="button" onClick={() => { setRecording('suggested'); setRoutineEditor(null); setError(''); setMessage('') }}>Registrar Día {progress.nextDay}</button>}
      </section>}
      <div className="heading session-heading"><h3>Entrenamientos realizados ({history.sessions.length})</h3>
        <button type="button" onClick={() => { setRecording('manual'); setRoutineEditor(null); setError(''); setMessage('') }}>+ Registrar entrenamiento</button></div>
      {recording && <CloudSessionRecorder key={recording} client={client} memberId={memberId} routines={history.routines} sessions={history.sessions}
        suggested={recording === 'suggested'} onSaved={() => { setRecording(null); setMessage('Entrenamiento guardado en Supabase.'); setRevision(value => value + 1) }}
        onCancel={() => setRecording(null)}/>}
      <section className="card profile">
        {history.sessions.length === 0 ? <p className="muted">Sin entrenamientos registrados.</p> : history.sessions.map(s => {
          const review = history.reviews.find(r => r.session_id === s.id)
          return <article className="cloud-history-item" key={s.id}><strong>{readableDate(s.performed_at)} · {s.routine_name || 'Sin rutina'}</strong>
            {(s.day || s.block || s.week) && <p>{s.day ? `Día ${s.day}` : ''}{s.block ? ` · Bloque ${s.block}` : ''}{s.week ? ` · Semana ${s.week}` : ''}</p>}
            {s.notes && <p>{s.notes}</p>}
            {s.results.length > 0 && <details><summary>Ver resultados</summary><ul>{s.results.map((result, index) =>
              <li key={`${result.exerciseId}-${index}`}><strong>{result.name}</strong> · {result.sets} series · {result.reps} repeticiones
                {result.load && ` · Carga ${result.load}`}{result.rir && ` · RIR ${result.rir}`}{result.comment && <p className="exercise-comment">{result.comment}</p>}</li>)}</ul></details>}
            {review ? <div className="session-review"><strong>Revisado por {review.trainer_name} · {readableDate(review.reviewed_at)}</strong>{review.notes && <span>{review.notes}</span>}</div> : <p className="muted">Pendiente de revisión.</p>}
            <div className="session-actions"><button type="button" className="secondary" disabled={saving || Boolean(deletingSessionId)} onClick={() => openReview(s.id, review)}>{review ? 'Editar revisión' : 'Revisar entrenamiento'}</button>
              <button type="button" className="text-button delete-action" disabled={saving || Boolean(deletingSessionId)} onClick={() => void deleteSession(s)}>{deletingSessionId === s.id ? 'Eliminando…' : 'Eliminar entrenamiento'}</button></div>
            {reviewingId === s.id && <form className="session-review-form" onSubmit={event => void saveReview(event)}>
              <label>Nombre del entrenador *<input required maxLength={120} value={reviewForm.trainerName} onChange={event => setReviewForm({ ...reviewForm, trainerName: event.target.value })}/></label>
              <label>Comentario para el alumno (opcional)<textarea maxLength={4000} value={reviewForm.notes} onChange={event => setReviewForm({ ...reviewForm, notes: event.target.value })}/></label>
              <div className="actions"><button type="submit" disabled={saving || Boolean(deletingSessionId)}>{saving ? 'Guardando…' : 'Guardar revisión'}</button><button type="button" className="secondary" disabled={saving || Boolean(deletingSessionId)} onClick={() => setReviewingId(null)}>Cancelar</button></div>
            </form>}
          </article>
        })}</section>
    </>}
    <button type="button" className="back" onClick={onClose}>← Volver a socios</button>
  </div>
}
