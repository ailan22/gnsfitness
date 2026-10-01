import { readAllPages } from './readAllPages'
import { useRef, useState, type FormEvent } from 'react'
import { confirmedInsert } from './confirmedInsert'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionExerciseResult } from './data'
import { parseDay } from './membership'
import { plannedComponents, plannedExercises, plannedGuidance, trainingProgress, type CloudRoutine, type CloudSession } from './cloudTraining'

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
const blankResult = (ex: { id: string; name: string }): SessionExerciseResult => ({ exerciseId: ex.id, name: ex.name, sets: '', reps: '', load: '', rir: '' })

export default function CloudSessionRecorder({ client, memberId, routines, sessions, suggested, onSaved, onCancel }: {
  client: SupabaseClient; memberId: string; routines: CloudRoutine[]; sessions: CloudSession[]; suggested: boolean
  onSaved: () => void; onCancel: () => void
}) {
  const current = routines[0]
  const currentProgress = current && trainingProgress(current, routines, sessions, today())
  const [performedAt, setPerformedAt] = useState(today)
  const [routineId, setRoutineId] = useState(suggested ? current?.id ?? '' : '')
  const [day, setDay] = useState(suggested && currentProgress && !currentProgress.finished ? String(currentProgress.nextDay) : '')
  const [notes, setNotes] = useState('')
  const [results, setResults] = useState<SessionExerciseResult[]>(() => suggested && current && currentProgress && !currentProgress.finished
    ? plannedExercises(current.plan, currentProgress.nextDay, currentProgress.block, currentProgress.week, current.block_rounds, current.program_rounds).map(blankResult) : [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [submissionId] = useState(() => crypto.randomUUID())
  const saveBusy = useRef(false)
  const routine = routines.find(item => item.id === routineId)
  const block = routine && routine.id === current?.id ? currentProgress?.block ?? 1 : 1
  const week = routine && routine.id === current?.id ? currentProgress?.week ?? 1 : 1
  const exercises = routine && day ? plannedExercises(routine.plan, Number(day), block, week, routine.block_rounds, routine.program_rounds) : []
  function selectDay(value: string, selectedRoutine = routine) {
    setDay(value)
    setResults(selectedRoutine && value ? plannedExercises(selectedRoutine.plan, Number(value),
      selectedRoutine.id === current?.id ? currentProgress?.block ?? 1 : 1,
      selectedRoutine.id === current?.id ? currentProgress?.week ?? 1 : 1,
      selectedRoutine.block_rounds, selectedRoutine.program_rounds).map(blankResult) : [])
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || saveBusy.current) return
    if (!parseDay(performedAt) || performedAt > today() || notes.length > 4000 ||
      (routineId && !routine) || (day && (!routine || !Number.isInteger(Number(day)) || Number(day) < 1 || Number(day) > routine.days_per_week))) {
      setError('Revisá la fecha, la rutina y el día seleccionado.'); return
    }
    const completedResults = results.filter(item => exercises.some(ex => ex.id === item.exerciseId))
      .filter(item => item.sets.trim() || item.reps.trim() || item.load.trim() || item.rir.trim())
    if (completedResults.some(item => [item.sets, item.reps, item.load, item.rir].some(value => value.length > 60))) {
      setError('Cada resultado admite hasta 60 caracteres.'); return
    }
    saveBusy.current = true
    setSaving(true); setError('')
    try {
    // The stable request ID prevents an uncertain network response from creating
    // another session when this form is retried.
    const existing = await client.from('sessions').select('id').eq('id', submissionId).eq('member_id', memberId).maybeSingle()
    if (existing.error) { setError('No se pudo verificar el guardado. Revisá la conexión e intentá nuevamente.'); return }
    if (!existing.data && suggested && current) {
      const latest = await readAllPages((from, to) => client.from('sessions').select('id,performed_at,routine_id,routine_name,day,block,week,notes,results,created_at', { count: 'exact' })
        .eq('member_id', memberId).order('id').range(from, to))
      if (latest.error || !latest.data) {
        setSaving(false); setError('No se pudo verificar el próximo día en Supabase. Actualizá la ficha.'); return
      }
      const fresh = trainingProgress(current, routines, latest.data as CloudSession[], today())
      if (fresh.finished || routineId !== current.id || Number(day) !== fresh.nextDay ||
        fresh.block !== block || fresh.week !== week) {
        setSaving(false); setError('El próximo entrenamiento cambió. Volvé a la ficha y abrí el día actualizado.'); return
      }
    }
    const row = { id: submissionId, member_id: memberId, performed_at: performedAt,
      routine_id: routine?.id ?? null, routine_name: routine?.name ?? '', day: day ? Number(day) : null,
      block: routine && day ? block : null, week: routine && day ? (block - 1) * routine.block_rounds + week : null,
      notes: notes.trim(), results: completedResults }
    await confirmedInsert(client, 'sessions', row)
    onSaved()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo confirmar el guardado. Conservá el formulario y revisá el historial antes de crear otro registro.')
    } finally {
      saveBusy.current = false
      setSaving(false)
    }
  }
  return <section className="card form cloud-session-form">
    <div className="heading"><h2>{suggested && day ? `Registrar Día ${day}` : 'Registrar entrenamiento'}</h2><button type="button" className="secondary" disabled={saving} onClick={onCancel}>Cancelar</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    <form onSubmit={event => void save(event)}>
      <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="grid"><label>Fecha *<input type="date" required max={today()} value={performedAt} onChange={event => setPerformedAt(event.target.value)}/></label>
        <label>Rutina<select disabled={suggested} value={routineId} onChange={event => {
          setRoutineId(event.target.value); selectDay('', routines.find(item => item.id === event.target.value))
        }}><option value="">Sin rutina</option>{routines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {routine && <label>Día de la rutina<select disabled={suggested} value={day} onChange={event => selectDay(event.target.value)}><option value="">Sin especificar</option>{Array.from({ length: routine.days_per_week }, (_, index) => index + 1).map(n => <option key={n} value={n}>Día {n}</option>)}</select></label>}</div>
      {routine && day && <p className="student-progress">Bloque {block} · Semana {(block - 1) * routine.block_rounds + week} · Día {day}</p>}
      {exercises.length > 0 && <section className="session-exercises"><h3>Resultados por ejercicio</h3><p className="muted">Cargá lo realizado. Los ejercicios sin resultados pueden quedar vacíos.</p>
        {exercises.map(ex => {
          const value = results.find(item => item.exerciseId === ex.id)
          const previous = sessions.filter(item => item.performed_at <= performedAt).flatMap(item => item.results ?? [])
            .find(item => item.exerciseId === ex.id || item.name.toLocaleLowerCase('es') === ex.name.toLocaleLowerCase('es'))
          return <div key={ex.id} className="session-exercise"><strong>{ex.name}</strong>
            <small>Planificado: {ex.sets || '—'} series · {ex.reps || '—'} repeticiones · Carga {ex.load || '—'} · RIR {ex.rir || '—'}</small>
            {previous && <small>Anterior: {previous.sets || '—'} series · {previous.reps || '—'} repeticiones · Carga {previous.load || '—'} · RIR {previous.rir || '—'}</small>}
            <div className="grid">{(['sets','reps','load','rir'] as const).map(key => <label key={key}>{({sets:'Series realizadas',reps:'Repeticiones realizadas',load:'Carga utilizada',rir:'RIR real'})[key]}
              <input maxLength={60} value={value?.[key] ?? ''} onChange={event => setResults(current => current.map(item => item.exerciseId === ex.id ? { ...item, [key]: event.target.value } : item))}/></label>)}</div>
          </div>
        })}</section>}
      {routine && day && plannedGuidance(routine.plan, Number(day), block, week, routine.block_rounds, routine.program_rounds) &&
        <div className="session-guidance"><strong>Indicaciones para este día</strong><p>{plannedGuidance(routine.plan, Number(day), block, week, routine.block_rounds, routine.program_rounds)}</p></div>}
      {routine && day && plannedComponents(routine.plan, Number(day), block, week, routine.block_rounds, routine.program_rounds).map(part =>
        <div className="session-guidance" key={part.id}><strong>{part.title}</strong><p>{part.details}</p></div>)}
      <label>Observaciones<textarea maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)}/></label>
      <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar entrenamiento'}</button>
      </fieldset>
    </form>
  </section>
}
