import { StudentWellbeing } from './StudentWellbeing'
import { readAllPages } from './readAllPages'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { SessionExerciseResult } from './data'
import { lastExerciseResult, plannedComponents, plannedExercises, plannedGuidance, trainingProgress, type CloudRoutine, type CloudSession } from './cloudTraining'

type Member = { id: string; first_name: string; last_name: string; status: string; goal: string; trainer_name: string; welcome_form: 'Bienvenido' | 'Bienvenida' | 'Te damos la bienvenida' }
type Review = { session_id: string; trainer_name: string; notes: string; reviewed_at: string }
type History = { member: Member; routines: CloudRoutine[]; sessions: CloudSession[]; reviews: Review[] }
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

export default function CloudStudent({ client, user }: { client: SupabaseClient; user: User }) {
  const [section, setSection] = useState<'training'|'progress'|'nutrition'>('training')
  const [wellbeingDirty, setWellbeingDirty] = useState(false)
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [recording, setRecording] = useState(false)
  const [checked, setChecked] = useState<string[]>([])
  const targetExercise = useRef<string | null>(null)
  const todayCard = useRef<HTMLElement>(null)
  const [saving, setSaving] = useState(false)
  const [performedAt, setPerformedAt] = useState(today)
  const [notes, setNotes] = useState('')
  const [results, setResults] = useState<SessionExerciseResult[]>([])
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID())
  const awaitingNextDay = useRef(false)
  const recordingRef = useRef(false)
  const savingRef = useRef(false)
  const recordForm = useRef<HTMLFormElement>(null)
  const [expected, setExpected] = useState<{ lastId: string | null; day: number; week: number } | null>(null)

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (recordingRef.current) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  useEffect(() => {
    if (recording) {
      recordForm.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      recordForm.current?.focus({ preventScroll: true })
      if (targetExercise.current) {
        document.getElementById(`exercise-${targetExercise.current}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        targetExercise.current = null
      }
    }
  }, [recording])

  useEffect(() => {
    let active = true
    let request = 0
    let fetching = false
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const fetchStudent = async () => {
      if (fetching || !active || recordingRef.current) return
      fetching = true
      try {
        const currentRequest = ++request
        const memberResult = await client.from('members').select('id,first_name,last_name,status,goal,trainer_name,welcome_form').eq('user_id', user.id).maybeSingle()
        if (!active || currentRequest !== request) return
        if (memberResult.error || !memberResult.data) {
          if (awaitingNextDay.current) { setMessage('Entrenamiento guardado. Actualizá la página para consultar tu próximo día.'); awaitingNextDay.current = false }
          setHistory(null); setError(memberResult.error ? 'No se pudo consultar tu ficha.' : 'Tu cuenta todavía no está vinculada con una ficha de socio. Pedile al administrador que la vincule.'); setLoading(false); return
        }
        const id = memberResult.data.id
        const [routines, sessions, reviews] = await Promise.all([
          readAllPages((from, to) => client.from('routines').select('id,name,goal,level,days_per_week,program_rounds,block_rounds', { count: 'exact' }).eq('member_id', id).order('created_at', { ascending: false }).order('id').range(from, to)),
          readAllPages((from, to) => client.from('sessions').select('id,performed_at,routine_id,routine_name,day,block,week,notes,results,created_at', { count: 'exact' }).eq('member_id', id).order('performed_at', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to)),
          readAllPages((from, to) => client.from('session_reviews').select('session_id,trainer_name,notes,reviewed_at', { count: 'exact' }).eq('member_id', id).order('session_id', { ascending: true }).range(from, to)),
        ])
        if (!active || currentRequest !== request) return
        setLoading(false)
        if ([routines, sessions, reviews].some(result => result.error)) {
          if (awaitingNextDay.current) { setMessage('Entrenamiento guardado. Actualizá la página para consultar tu próximo día.'); awaitingNextDay.current = false }
          setHistory(null); setError('No se pudo leer tu programa completo. Actualizá la pantalla e intentá nuevamente.'); return
        }
        // Historical routine names are needed to match legacy sessions, but
        // only the current routine's exercise plan is displayed by this panel.
        const routineRows: CloudRoutine[] = (routines.data ?? []).map(row => ({ ...row, plan: {} }))
        if (routineRows[0]) {
          const currentPlan = await client.from('routines').select('plan').eq('member_id', id).eq('id', routineRows[0].id).single()
          if (!active || currentRequest !== request) return
          if (currentPlan.error || !currentPlan.data) {
            setHistory(null); setError('No se pudo cargar tu rutina actual. Actualizá la pantalla.'); return
          }
          routineRows[0].plan = currentPlan.data.plan
        }
        const updatedHistory = { member: memberResult.data as Member, routines: routineRows, sessions: sessions.data as CloudSession[], reviews: reviews.data as Review[] }
        if (recordingRef.current) return
        setHistory(updatedHistory)
        if (awaitingNextDay.current) {
          const latestRoutine = updatedHistory.routines[0]
          const next = latestRoutine && trainingProgress(latestRoutine, updatedHistory.routines, updatedHistory.sessions, today())
          setMessage(next ? next.finished ? 'Entrenamiento guardado. Completaste el programa.' : `Entrenamiento guardado. Tu próximo entrenamiento es el Día ${next.nextDay}.` : 'Entrenamiento guardado. Consultá con tu entrenador para conocer tu próximo día.')
          awaitingNextDay.current = false
        }
        setError('')
      } catch {
        if (active) { setLoading(false); setError('No se pudo actualizar tu programa. Revisá tu conexión y volvé a intentar.') }
      } finally { fetching = false }
    }
    const initialTimer = setTimeout(() => { void fetchStudent() }, 0)
    const refreshWhenReturning = () => {
      if (document.visibilityState !== 'visible') return
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => { void fetchStudent() }, 150)
    }
    window.addEventListener('focus', refreshWhenReturning)
    document.addEventListener('visibilitychange', refreshWhenReturning)
    return () => {
      active = false
      clearTimeout(initialTimer); clearTimeout(refreshTimer)
      window.removeEventListener('focus', refreshWhenReturning)
      document.removeEventListener('visibilitychange', refreshWhenReturning)
    }
  }, [client, user.id, revision])

  const routine = history?.routines[0]
  const progress = routine && history ? trainingProgress(routine, history.routines, history.sessions, today()) : null
  const exercises = routine && progress ? plannedExercises(routine.plan, progress.nextDay, progress.block, progress.week, routine.block_rounds, routine.program_rounds) : []
  const components = routine && progress ? plannedComponents(routine.plan, progress.nextDay, progress.block, progress.week, routine.block_rounds, routine.program_rounds) : []
  const guidance = routine && progress ? plannedGuidance(routine.plan, progress.nextDay, progress.block, progress.week, routine.block_rounds, routine.program_rounds) : ''
  const detail = routine && progress ? routine.plan.blockDetails?.[progress.block] : undefined
  const globalWeek = routine && progress ? (progress.block - 1) * routine.block_rounds + progress.week : 1
  const blockWeeks = routine && progress ? Math.min(routine.block_rounds, routine.program_rounds - (progress.block - 1) * routine.block_rounds) : 0
  const messages = history?.reviews.filter(item => item.notes.trim()).sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at)) ?? []

  function begin(exerciseId?: string) {
    targetExercise.current = exerciseId ?? null
    if (!routine || !progress || progress.finished || !exercises.length || recordingRef.current || history?.member.status !== 'Activo') return
    setChecked([]); setPerformedAt(today()); setNotes(''); setError(''); setMessage(''); setSubmissionId(crypto.randomUUID())
    setResults(exercises.map(item => ({ exerciseId: item.id, name: item.name, sets: '', reps: '', load: '', rir: '', comment: '' })))
    setExpected({ lastId: progress.last?.id ?? null, day: progress.nextDay, week: globalWeek })
    recordingRef.current = true
    setRecording(true)
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!routine || !progress || !expected || saving || savingRef.current || !/^\d{4}-\d{2}-\d{2}$/.test(performedAt) || performedAt > today() || notes.length > 4000) return
    if (checked.length < exercises.length && !window.confirm('Quedan ejercicios sin marcar. ¿Querés finalizar igualmente este día?')) return
    savingRef.current = true
    setSaving(true); setError('')
    const filled = results.filter(item => [item.sets, item.reps, item.load, item.rir, item.comment ?? ''].some(value => value.trim()))
    try {
      const { error: writeError } = await client.rpc('student_register_next_day_checked', {
        p_request_id: submissionId, p_routine_id: routine.id, p_performed_at: performedAt, p_notes: notes.trim(), p_results: filled,
        p_expected_last_id: expected.lastId, p_expected_day: expected.day, p_expected_week: expected.week,
      })
      if (writeError) {
        setError(writeError.code === 'PGRST202' || writeError.code === '42883'
          ? 'Falta activar la protección de entrenamientos. Contactá al administrador.'
          : 'No se pudo guardar el día. Si otro dispositivo registró un entrenamiento, actualizá la pantalla y volvé a intentarlo.'); return
      }
      awaitingNextDay.current = true
      recordingRef.current = false
      setRecording(false); setMessage('Día completado. Cargando tu próximo entrenamiento…'); setRevision(value => value + 1)
    } catch {
      setError('No se pudo confirmar el guardado. Revisá tu conexión y volvé a intentar; la misma solicitud no se registrará dos veces.')
    } finally { savingRef.current = false; setSaving(false) }
  }

  return <section className="cloud-student" aria-label="Portal del alumno">
    <div className="student-brand"><img src="/gns-logo-transparent.png" alt="GNS Fitness" width="100" height="100"/><p className="eyebrow">TU ESPACIO · GNS FITNESS</p></div>
    {loading ? <p>Cargando tu programa…</p> : !history ? <p className="notice">{error || 'Tu ficha no está disponible.'}</p> : <>
      <h1>¡{history.member.welcome_form}, {history.member.first_name}!</h1>
      <p className="muted">Acá tenés tu rutina y la guía para entrenar. {history.member.trainer_name && `Tu entrenador: ${history.member.trainer_name}.`}</p>
      {message && <p role="status" className="notice">{message}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <nav className="student-section-nav" aria-label="Secciones del alumno">{([['training','Mi rutina'],['nutrition','Nutrición'],['progress','Historial']] as const).map(([id,label])=><button key={id} className={section===id?'':'secondary'} aria-current={section===id?'page':undefined} onClick={()=>{if(id===section)return;if(wellbeingDirty&&!window.confirm('Hay un dato sin guardar. ¿Descartarlo y cambiar de sección?'))return;setWellbeingDirty(false);setSection(id)}}><strong>{label}</strong><small>{id==='training'?'Rutina, pesos y ejercicios':id==='nutrition'?'Guías y alimentación':'Tu historial y tus avances'}</small></button>)}</nav>
      {section==='nutrition'&&<StudentWellbeing key={section} client={client} memberId={history.member.id} section="nutrition" onDirtyChange={setWellbeingDirty}/>}
      <div hidden={section!=='training'}>
      {!routine || !progress ? <div className="card empty">Todavía no tenés una rutina asignada. Consultá con tu entrenador.</div> : <>
        <section ref={todayCard} className="card student-today">
          <p className="eyebrow">MI ENTRENAMIENTO DE HOY</p>
          <h2>{progress.finished ? 'Programa completado' : `Día ${progress.nextDay}`}</h2>
          {!progress.finished && <p className="student-welcome">{history.member.welcome_form === 'Te damos la bienvenida' ? '¡Hoy es un buen día para entrenar!' : `¡${history.member.welcome_form} a tu día de entrenamiento!`} Te toca el Día {progress.nextDay}. Seguí la guía y anotá tus resultados mientras entrenás.</p>}
          <p>{routine.name} · {routine.level} · {routine.days_per_week} días por semana</p>
          <p className="student-progress">Bloque {progress.block}{detail?.name ? ` · ${detail.name}` : ''} · Semana {globalWeek} de {routine.program_rounds}</p>
          {progress.last && <p className="muted">Último día registrado: Día {progress.last.day} · {progress.last.performed_at}</p>}
          {!progress.finished && <div className="actions student-start"><button type="button" disabled={!exercises.length || history.member.status !== 'Activo'} onClick={() => recording ? recordForm.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : begin()}>{recording ? 'Continuar mi entrenamiento' : 'Empezar entrenamiento'}</button><span className="muted">{exercises.length} {exercises.length === 1 ? 'ejercicio' : 'ejercicios'}{recording ? ' · En curso' : ''}</span></div>}
          {detail?.warmup && <div className="block-note"><strong>Calentamiento del bloque</strong><p>{detail.warmup}</p></div>}
          {progress.finished ? <p>Consultá con tu entrenador antes de iniciar un programa nuevo.</p> : <>
            {exercises.length ? !recording && <div className="student-exercises">{exercises.map((item, index) => <div className="student-exercise" key={item.id}>
              <strong>{index + 1}. {item.name}</strong><span>{item.sets || '—'} series · {item.reps || '—'} repeticiones · RIR {item.rir || '—'} · Descanso {item.rest || '—'}{item.load ? ` · Carga ${item.load}` : ''}</span>{item.notes && <span>{item.notes}</span>}
              <PreviousResult sessions={history.sessions} routineId={routine.id} exercise={item}/>
              <button type="button" className="secondary exercise-record-button" disabled={history.member.status !== 'Activo'} onClick={() => begin(item.id)}>Registrar peso y comentario</button>
            </div>)}</div> : <p>Este día no tiene ejercicios cargados. Consultá con tu entrenador.</p>}
            {guidance && <div className="session-guidance"><strong>Indicaciones para este día</strong><p>{guidance}</p></div>}
            {components.map(item => <div className="session-guidance" key={item.id}><strong>{item.title}</strong><p>{item.details}</p></div>)}

            {!exercises.length && <p className="muted">Para habilitar este día, tu entrenador debe cargar sus ejercicios. Tu avance anterior queda guardado.</p>}
            {history.member.status !== 'Activo' && <p className="notice">Tu ficha no está activa. Contactá al administrador para registrar entrenamientos.</p>}
          </>}
        </section>
        {recording && !progress.finished && <form ref={recordForm} tabIndex={-1} aria-label={`Registrar Día ${progress.nextDay}`} className="card student-record" onSubmit={event => void save(event)}>
          <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <div className="heading"><h2>Registrar Día {progress.nextDay}</h2><button type="button" className="secondary" disabled={saving} onClick={() => { if (!window.confirm('¿Descartar el entrenamiento en curso y sus resultados sin guardar?')) return; recordingRef.current = false; setRecording(false); setChecked([]); setRevision(value => value + 1) }}>Cancelar</button></div>
          <p className="muted">Marcá cada ejercicio al terminar y anotá lo realizado. Solo «Guardar y completar día» registra la sesión y habilita el siguiente día.</p>
          <div className="student-check-progress" role="status">{checked.length} de {exercises.length} ejercicios marcados</div>
          <progress className="student-progress-bar" aria-label="Ejercicios marcados" value={checked.length} max={Math.max(1, exercises.length)}/>
          <p className="muted">Podés bloquear el celular y volver mientras la app siga abierta. Guardá antes de cerrar o recargar: este registro todavía no está enviado.</p>
          <label>Fecha del entrenamiento<input type="date" required max={today()} value={performedAt} onChange={event => setPerformedAt(event.target.value)}/></label>
          {exercises.map(item => <div className={`session-exercise ${checked.includes(item.id) ? 'exercise-checked' : ''}`} key={item.id} id={`exercise-${item.id}`}><label className="exercise-check"><input type="checkbox" checked={checked.includes(item.id)} onChange={event => setChecked(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))}/><strong>{item.name}</strong><span>{checked.includes(item.id) ? 'Completado' : 'Marcar al terminar'}</span></label><small>Planificado: {item.sets || '—'} series · {item.reps || '—'} repeticiones · Carga {item.load || '—'} · RIR {item.rir || '—'}</small>
            <PreviousResult sessions={history.sessions} routineId={routine.id} exercise={item}/>
            <div className="grid">{(['load', 'sets', 'reps', 'rir'] as const).map(field => <label key={field}>{({ sets: 'Series realizadas', reps: 'Repeticiones realizadas', load: 'Peso utilizado (kg o tipo de carga)', rir: 'RIR real' })[field]}
              <input placeholder={field === 'load' ? 'Ej.: 20 kg; o 20 / 22 / 22 kg por serie' : undefined} maxLength={60} value={results.find(result => result.exerciseId === item.id)?.[field] ?? ''} onChange={event => setResults(current => current.map(result => result.exerciseId === item.id ? { ...result, [field]: event.target.value } : result))}/></label>)}</div>
            <label>Comentario del ejercicio (opcional)<textarea rows={2} maxLength={300} placeholder="Ej.: completé las series con buena técnica" value={results.find(result => result.exerciseId === item.id)?.comment ?? ''} onChange={event => setResults(current => current.map(result => result.exerciseId === item.id ? { ...result, comment: event.target.value } : result))}/></label>
          </div>)}
          <label>Comentario del entrenamiento (opcional)<textarea rows={2} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)}/></label>
          <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar y completar día'}</button>
                  </fieldset>
        </form>}
        {messages.length > 0 && <section className="student-feedback"><h2>Mensajes de tu entrenador</h2><div className="list">{messages.map(item => {
          const session = history.sessions.find(record => record.id === item.session_id)
          return <article key={item.session_id} className="card student-feedback-item"><strong>{item.trainer_name} · {item.reviewed_at}</strong><p className="muted">Entrenamiento del {session?.performed_at ?? 'sin fecha'}{session?.day ? ` · Día ${session.day}` : ''}</p><p>{item.notes}</p></article>
        })}</div></section>}
        <details className="student-plan-details"><summary>Ver mi planificación completa</summary><h2 className="student-program-title">Tu planificación · Bloque {progress.block}</h2>
        {detail?.warmup && <section className="card block-note"><h3>Calentamiento específico del bloque</h3><p>{detail.warmup}</p></section>}
        {Array.from({ length: blockWeeks }, (_, index) => index + 1).map(week => <section className="program-week" key={week}>
          <h3>Semana {(progress.block - 1) * routine.block_rounds + week} · Bloque {progress.block}{week === progress.week ? ' · Actual' : ''}</h3>
          <div className="student-program">{Array.from({ length: routine.days_per_week }, (_, index) => index + 1).map(day => {
            const current = !progress.finished && week === progress.week && day === progress.nextDay
            const future = !progress.finished && (week > progress.week || (week === progress.week && day > progress.nextDay))
            return <section className={`card student-day ${current ? 'student-day-next' : ''}`} key={day}>
            <h4>Día {day}{current ? ' · Disponible' : future ? ' · Bloqueado' : ' · Anterior'}</h4>
            {plannedExercises(routine.plan, day, progress.block, week, routine.block_rounds, routine.program_rounds).map(item => <p key={item.id}><strong>{item.name}</strong> · {item.sets || '—'} × {item.reps || '—'}</p>)}
            {plannedGuidance(routine.plan, day, progress.block, week, routine.block_rounds, routine.program_rounds) && <div className="session-guidance"><strong>Indicaciones</strong><p>{plannedGuidance(routine.plan, day, progress.block, week, routine.block_rounds, routine.program_rounds)}</p></div>}
            {plannedComponents(routine.plan, day, progress.block, week, routine.block_rounds, routine.program_rounds).map(item => <div className="session-guidance" key={item.id}><strong>{item.title}</strong><p>{item.details}</p></div>)}
            {current ? <>
              <button type="button" disabled={recording || !exercises.length || history.member.status !== 'Activo'} onClick={() => begin()}>{recording ? 'Completá el registro abierto' : `Completar Día ${day}`}</button>
              <p className="muted">{!exercises.length ? 'Faltan ejercicios para este día. Tu entrenador debe completar la rutina.' : 'Guardá el registro de este día para habilitar el siguiente.'}</p>
            </> : future ? <><button type="button" disabled>Completar Día {day} · Bloqueado</button><p className="muted">Se habilita al completar los días anteriores en orden.</p></> : <p className="muted">Los entrenamientos guardados figuran en tu registro.</p>}
          </section>})}</div>
        </section>)}
        {detail?.objective && <section className="card block-note"><h3>Objetivo del bloque</h3><p>{detail.objective}</p></section>}
        </details>

      </>}
      </div>
      {section==='progress' && <>        <section className="card" aria-label="Mi registro de entrenamientos"><h2>Mis entrenamientos</h2>
          {history.sessions.length === 0 ? <p>Todavía no registraste entrenamientos.</p> : <>
            <p className="muted">Últimos {Math.min(10, history.sessions.length)} de {history.sessions.length} entrenamientos guardados.</p>
            {history.sessions.slice(0, 10).map(session => <article key={session.id} className="student-feedback-item">
              <h3>{session.performed_at} · {session.day ? `Día ${session.day}` : 'Entrenamiento'}</h3>
              <p>{session.routine_name}</p>
              {session.notes && <p>{session.notes}</p>}
              {session.results?.length > 0 && <details><summary>Ver mis resultados</summary>{session.results.map((result, index) => <p key={`${result.exerciseId}-${index}`}><strong>{result.name}</strong> · Series: {result.sets || '—'} · Repeticiones: {result.reps || '—'} · Carga: {result.load || '—'} · RIR: {result.rir || '—'}{result.comment && <span className="exercise-comment">{result.comment}</span>}</p>)}</details>}
            </article>)}
          </>}
        </section></>}
    </>}
  </section>
}

function PreviousResult({ sessions, routineId, exercise }: { sessions: CloudSession[]; routineId: string; exercise: import('./data').Exercise }) {
  const previous = lastExerciseResult(sessions, routineId, exercise, today())
  if (!previous) return <small className="student-last-result">Sin registro anterior para este ejercicio.</small>
  const { result, date } = previous
  return <small className="student-last-result">Último registro · {date}: {result.sets || '—'} series · {result.reps || '—'} repeticiones · Carga {result.load || 'sin registrar'} · RIR {result.rir || '—'}. Referencia de lo realizado, no una nueva indicación.{result.comment && <span className="exercise-comment">Tu comentario: {result.comment}</span>}</small>
}
