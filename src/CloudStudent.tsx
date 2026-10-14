import ProtectedNutrition from './ProtectedNutrition'
import './StudentCards.css'
import approvedHome from './assets/student-home-full-photo-oct13.png'
import GnsMethod from './GnsMethod'
import ProgramResults from './ProgramResults'
import PlanNotifications from './PlanNotifications'
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

const ignoreNutritionDirty = () => {}

export default function CloudStudent({ client, user }: { client: SupabaseClient; user: User }) {
  const [section, setSection] = useState<'home' | 'training' | 'nutrition' | 'method' | 'results'>('home')
  const nutritionOpen = section === 'nutrition'
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [recording, setRecording] = useState(false)
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
  function selectSection(next: typeof section) { setSection(next) }

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (recordingRef.current) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

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

  const tests = routine?.plan.sessionTests?.[globalWeek]?.[progress?.nextDay ?? 1] ?? []
  const isTestDay = tests.length > 0
  const canRecord = exercises.length > 0 || isTestDay

  function begin() {
    if (!routine || !progress || progress.finished || !canRecord || recordingRef.current || history?.member.status !== 'Activo') return
    setPerformedAt(today()); setNotes(isTestDay ? `Día de prueba: ${tests.map(t=>t.title).join(', ')}\nResultado: ` : ''); setError(''); setMessage(''); setSubmissionId(crypto.randomUUID())
    setResults(exercises.map(item => ({ exerciseId: item.id, name: item.name, sets: '', reps: '', load: '', rir: '' })))
    setExpected({ lastId: progress.last?.id ?? null, day: progress.nextDay, week: globalWeek })
    recordingRef.current = true
    setRecording(true)
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!routine || !progress || !expected || saving || savingRef.current || !/^\d{4}-\d{2}-\d{2}$/.test(performedAt) || performedAt > today() || notes.length > 4000) return
    savingRef.current = true
    setSaving(true); setError('')
    const filled = results.filter(item => [item.load, item.rir].some(value => value.trim()))
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
      setResults([]); setExpected(null)
      setRecording(false); setMessage('Día completado. Cargando tu próximo entrenamiento…'); setRevision(value => value + 1)
    } catch {
      setError('No se pudo confirmar el guardado. Revisá tu conexión y volvé a intentar; la misma solicitud no se registrará dos veces.')
    } finally { savingRef.current = false; setSaving(false) }
  }

  return <section className="cloud-student student-cards-design" data-section={section} aria-label="Portal del alumno">
    <header className="student-cards-brand"><img src="/gns-logo-transparent.png" alt="GNS"/><div><strong>GNS <span>FITNESS</span></strong><small>ENERGÍA · SALUD · BIENESTAR · VITALIDAD</small></div></header>
    <div className="student-toolbar">
      {section === 'home' && <div className="student-space-label"><img src="/gns-logo-transparent.png" alt="" width="30" height="30"/><span>TU ESPACIO</span></div>}
      <div className="student-top-actions">{section !== 'home' && <button type="button" className="student-back" aria-label="Volver al inicio" onClick={() => selectSection('home')}>←</button>}{history && <PlanNotifications client={client} memberId={history.member.id} appearance="bell"/>}</div>
    </div>
    {section === 'home' && <div className="student-home-menu"><nav aria-label="Elegí una sección">
      {(['training','nutrition','method','results'] as const).map((key,index)=><button key={key} type="button" className={'student-menu-card student-menu-'+key} onClick={()=>selectSection(key)}>
        <span className="student-menu-photo student-approved-photo" aria-hidden="true"><img src={approvedHome} alt=""/></span>
        <svg className="student-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{key==='training'?<path d="M3 7v10M7 4v16M17 4v16M21 7v10M3 9h4m0 3h10m0-3h4M3 15h4m10 0h4"/>:key==='nutrition'?<path d="M12 8c-8-6-13 3-7 11 2 3 4 2 7 1 3 1 5 2 7-1 6-8 1-17-7-11Zm0 0c0-5 2-7 5-6 0 3-2 5-5 6Z"/>:key==='method'?<path d="M12 5v15M12 5C8 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-6-1-10 1Z"/>:<path d="M3 21V12h4v9m3 0V7h4v14m3 0V2h4v19"/>}</svg>
        <span className="student-menu-title">{['MI ENTRENAMIENTO','ALIMENTACIÓN SALUDABLE','MÉTODO GNS','RESULTADOS DEL PROGRAMA'][index]}</span><span className="student-menu-arrow" aria-hidden="true">›</span>
      </button>)}
    </nav><p className="student-brand-signature"><span>GYM NATURE SOUL</span></p></div>}
    {loading ? <p>Cargando tu programa…</p> : !history ? <p className="notice">{error || 'Tu ficha no está disponible.'}</p> : <>
      {section !== 'home' && <header className={'student-section-heading student-section-'+section}><h1>{section === 'training' ? 'MI ENTRENAMIENTO' : section === 'nutrition' ? 'ALIMENTACIÓN SALUDABLE' : section === 'method' ? 'MÉTODO GNS' : 'RESULTADOS DEL PROGRAMA'}</h1></header>}
      <p hidden={section === 'home' || section === 'nutrition' || section === 'method' || section === 'results'} className="muted">{nutritionOpen ? 'Tu alimentación, con acompañamiento profesional.' : section === 'training' ? 'Tu entrenamiento, paso a paso.' : section === 'method' ? 'Movimiento, constancia y acompañamiento.' : 'Los cambios observados en tu proceso.'} {history.member.trainer_name && `Tu entrenador: ${history.member.trainer_name}.`}</p>
      {message && <p role="status" className="notice">{message}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {nutritionOpen && <section className="student-nutrition-panel" aria-label="Nutrición">
        <ProtectedNutrition owner={history.member.first_name+' · '+history.member.id.slice(-6)}><StudentWellbeing client={client} memberId={history.member.id} section="nutrition" onDirtyChange={ignoreNutritionDirty}/></ProtectedNutrition>
      </section>}
      {section === 'method' && <GnsMethod/>}
      {section === 'results' && <ProgramResults client={client} memberId={history.member.id}/>}
      <div hidden={section !== 'training'}>
      {!routine || !progress ? <div className="card empty">Todavía no tenés una rutina asignada. Consultá con tu entrenador.</div> : <>
        <form ref={recordForm} aria-label={`Registrar Día ${progress.nextDay}`} className="card student-today" onSubmit={event => void save(event)}>
          <div className="training-visual-header"><p className="eyebrow">{isTestDay ? 'DÍA DE PRUEBA' : 'TU PROGRAMA'}</p><h2>{routine.name}</h2><p>{progress.finished ? 'Programa completado' : isTestDay ? `Día de prueba · Día ${progress.nextDay}` : `Semana ${globalWeek} · Día ${progress.nextDay}`}</p></div>
          <div className="training-completion"><div><span>Tu avance</span><strong>{Math.round((progress.finished ? 1 : (progress.completed * routine.days_per_week + progress.nextDay - 1) / (routine.program_rounds * routine.days_per_week)) * 100)}%</strong></div><progress aria-label="Avance de entrenamientos registrados" max={routine.program_rounds * routine.days_per_week} value={progress.finished ? routine.program_rounds * routine.days_per_week : progress.completed * routine.days_per_week + progress.nextDay - 1}/><small>Según los entrenamientos guardados.</small></div>
          <details className="training-program-info"><summary>Detalles del programa</summary><p>{routine.level} · {routine.days_per_week} días por semana · {routine.program_rounds} semanas</p><p>Bloque {progress.block}{detail?.name ? ` · ${detail.name}` : ''}</p>{progress.last && <p>Último registro: Día {progress.last.day} · {progress.last.performed_at}</p>}</details>
          {!progress.finished && isTestDay && <div className="actions student-start"><button type="button" disabled={!canRecord || history.member.status !== 'Activo'} onClick={() => begin()}>{recording ? isTestDay ? 'Continuar mi prueba' : 'Continuar mi entrenamiento' : isTestDay ? 'Empezar prueba' : 'Empezar entrenamiento'}</button><span className="muted">{isTestDay && !exercises.length ? 'Evaluación programada' : `${exercises.length} ${exercises.length === 1 ? 'ejercicio' : 'ejercicios'}`}{recording ? ' · En curso' : ''}</span></div>}
          {detail?.warmup && <div className="block-note student-warmup"><strong>Calentamiento del bloque</strong><p>{detail.warmup}</p></div>}
          {progress.finished ? <p>Consultá con tu entrenador antes de iniciar un programa nuevo.</p> : <>
            {exercises.length ? <div className="student-exercises">{exercises.map((item, index) => <div className="student-exercise" key={`${globalWeek}-${progress.nextDay}-${item.id}`}>
              <strong>{index + 1}. {item.name}</strong><span>{item.sets || '—'} series · {item.reps || '—'} repeticiones · RIR {item.rir || '—'} · Descanso {item.rest || '—'}{item.load ? ` · Carga ${item.load}` : ''}</span>{item.notes && <span>{item.notes}</span>}
              <details className="exercise-history"><summary>Último registro</summary><PreviousResult sessions={history.sessions} routineId={routine.id} exercise={item}/></details>
              <div className="exercise-inline-row">

                <details className="exercise-inline-entry" onToggle={event => { if(event.currentTarget.open) begin() }}>
                  <summary aria-label={`Registrar kilos y RIR de ${item.name}`}>‹</summary>
                  <div className="exercise-inline-fields">{(['load','rir'] as const).map(field => <label key={field}><span>{field === 'load' ? 'Kg' : 'RIR'}</span><input aria-label={`${field === 'load' ? 'Kilos utilizados' : 'RIR real'} · ${item.name}`} disabled={saving || history.member.status !== 'Activo'} type="number" min="0" max={field === 'rir' ? 10 : undefined} step={field === 'load' ? 'any' : '1'} inputMode={field === 'load' ? 'decimal' : 'numeric'} placeholder="—" value={results.find(result => result.exerciseId === item.id)?.[field] ?? ''} onChange={event => { begin(); const value = event.target.value; setResults(current => current.map(result => result.exerciseId === item.id ? {...result,[field]:value} : result)) }}/></label>)}</div>
                </details>
              </div>
            </div>)}</div> : !isTestDay && <p>Este día no tiene ejercicios cargados. Consultá con tu entrenador.</p>}
            {guidance && <div className="session-guidance"><strong>Indicaciones para este día</strong><p>{guidance}</p></div>}
            {components.map(item => <div className="session-guidance" key={item.id}><strong>{item.title}</strong><p>{item.details}</p></div>)}
            {(routine.plan.sessionTests?.[(progress.block-1)*routine.block_rounds+progress.week]?.[progress.nextDay]??[]).map(item=><section className="student-test" key={item.id}><span>Prueba</span><h3>{item.title}</h3><p>{item.details}</p></section>)}

            {!canRecord && <p className="muted">Para habilitar este día, tu entrenador debe cargar sus ejercicios. Tu avance anterior queda guardado.</p>}
            {history.member.status !== 'Activo' && <p className="notice">Tu ficha no está activa. Contactá al administrador para registrar entrenamientos.</p>}
          </>}
          {!progress.finished && !recording && <div className="student-complete-visible"><button type="button" disabled={!canRecord || history.member.status !== 'Activo'} onClick={() => begin()}>Completar entrenamiento · Día {progress.nextDay}</button></div>}
          {!progress.finished && <fieldset disabled={saving || !recording} aria-hidden={!recording} style={{visibility: recording ? 'visible' : 'hidden'}} className="student-inline-save">
            <p className="muted" role="status">Resultados pendientes de guardar</p>
            <details><summary>Fecha del entrenamiento</summary><label>Fecha<input type="date" required max={today()} value={performedAt} onChange={event => setPerformedAt(event.target.value)}/></label></details>
            {isTestDay && <label>Resultado de la prueba<textarea rows={2} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)}/></label>}
            <div className="actions"><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar y completar día'}</button><button type="button" className="secondary" onClick={() => { if (!window.confirm('¿Descartar los resultados sin guardar?')) return; recordingRef.current = false; setRecording(false); setResults([]); setRevision(value => value + 1) }}>Cancelar</button></div>
          </fieldset>}
        </form>
        <details className="student-plan-details"><summary>Ver mi planificación completa</summary><h2 className="student-program-title">Tu planificación · Bloque {progress.block}</h2>
        {detail?.warmup && <section className="card block-note student-warmup"><h3>Calentamiento específico del bloque</h3><p>{detail.warmup}</p></section>}
        {Array.from({ length: blockWeeks }, (_, index) => index + 1).map(week => <section className="program-week" key={week}>
          <h3>Semana {(progress.block - 1) * routine.block_rounds + week} · Bloque {progress.block}{week === progress.week ? ' · Actual' : ''}</h3>
          <div className="student-program">{Array.from({ length: routine.days_per_week }, (_, index) => index + 1).map(day => {
            const current = !progress.finished && week === progress.week && day === progress.nextDay
            const future = !progress.finished && (week > progress.week || (week === progress.week && day > progress.nextDay))
            return <section className={`card student-day ${current ? 'student-day-next' : ''}`} key={day}>
            <h4>{routine.plan.sessionTests?.[(progress.block-1)*routine.block_rounds+week]?.[day]?.length ? 'Día de prueba · ' : ''}Día {day}{current ? ' · Disponible' : future ? ' · Bloqueado' : ' · Anterior'}</h4>
            {plannedExercises(routine.plan, day, progress.block, week, routine.block_rounds, routine.program_rounds).map(item => <p key={item.id}><strong>{item.name}</strong> · {item.sets || '—'} × {item.reps || '—'}</p>)}
            {plannedGuidance(routine.plan, day, progress.block, week, routine.block_rounds, routine.program_rounds) && <div className="session-guidance"><strong>Indicaciones</strong><p>{plannedGuidance(routine.plan, day, progress.block, week, routine.block_rounds, routine.program_rounds)}</p></div>}
            {plannedComponents(routine.plan, day, progress.block, week, routine.block_rounds, routine.program_rounds).map(item => <div className="session-guidance" key={item.id}><strong>{item.title}</strong><p>{item.details}</p></div>)}
            {(routine.plan.sessionTests?.[(progress.block-1)*routine.block_rounds+week]?.[day]??[]).map(item=><section className="student-test" key={item.id}><span>Prueba</span><h4>{item.title}</h4><p>{item.details}</p></section>)}
            {current ? <>
              <button type="button" disabled={recording || !canRecord || history.member.status !== 'Activo'} onClick={() => begin()}>{recording ? 'Completá el registro abierto' : `Completar Día ${day}`}</button>
              <p className="muted">{!canRecord ? 'Faltan ejercicios para este día. Tu entrenador debe completar la rutina.' : 'Guardá el registro de este día para habilitar el siguiente.'}</p>
            </> : future ? <><button type="button" disabled>Completar Día {day} · Bloqueado</button><p className="muted">Se habilita al completar los días anteriores en orden.</p></> : <p className="muted">Los entrenamientos guardados figuran en tu registro.</p>}
          </section>})}</div>
        </section>)}
        {detail?.objective && <section className="card block-note"><h3>Objetivo del bloque</h3><p>{detail.objective}</p></section>}
        </details>

      </>}
      </div>
      <details hidden={section !== 'training'} className="student-history-panel card" onToggle={event => setHistoryOpen(event.currentTarget.open)}><summary>Historial de entrenamientos</summary>{historyOpen && <section className="card" aria-label="Mi registro de entrenamientos"><h2>Mis entrenamientos</h2>
          {history.sessions.length === 0 ? <p>Todavía no registraste entrenamientos.</p> : <>
            <p className="muted">Últimos {Math.min(10, history.sessions.length)} de {history.sessions.length} entrenamientos guardados.</p>
            {history.sessions.slice(0, 10).map(session => <article key={session.id} className="student-feedback-item">
              <h3>{session.performed_at} · {session.day ? `Día ${session.day}` : 'Entrenamiento'}</h3>
              <p>{session.routine_name}</p>
              {session.notes && <p>{session.notes}</p>}
              {session.results?.length > 0 && <details><summary>Ver mis resultados</summary>{session.results.map((result, index) => <p key={`${result.exerciseId}-${index}`}><strong>{result.name}</strong> · Series: {result.sets || '—'} · Repeticiones: {result.reps || '—'} · Carga: {result.load || '—'} · RIR: {result.rir || '—'}{result.comment && <span className="exercise-comment">{result.comment}</span>}</p>)}</details>}
            </article>)}
          </>}
        </section>}</details>
    </>}
  </section>
}

function PreviousResult({ sessions, routineId, exercise }: { sessions: CloudSession[]; routineId: string; exercise: import('./data').Exercise }) {
  const previous = lastExerciseResult(sessions, routineId, exercise, today())
  if (!previous) return <small className="student-last-result">Sin registro anterior para este ejercicio.</small>
  const { result, date } = previous
  return <small className="student-last-result">Último registro · {date}: {result.sets || '—'} series · {result.reps || '—'} repeticiones · Carga {result.load || 'sin registrar'} · RIR {result.rir || '—'}. Referencia de lo realizado, no una nueva indicación.{result.comment && <span className="exercise-comment">Tu comentario: {result.comment}</span>}</small>
}

