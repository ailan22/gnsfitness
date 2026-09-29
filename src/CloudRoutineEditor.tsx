import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Exercise } from './data'
import { plannedExercises, plannedGuidance, plannedComponents, type CloudPlan, type CloudRoutine } from './cloudTraining'

const blankExercise = (): Exercise => ({ id: crypto.randomUUID(), name: '', sets: '', reps: '', load: '', rir: '', rest: '', tempo: '', notes: '' })
const cleanPlan = (): CloudPlan => ({ exercisesByDay: {}, blockExercises: {}, weekExercises: {}, blockDetails: {}, sessionGuidance: {}, sessionComponents: {} })

export default function CloudRoutineEditor({ client, memberId, initial, onSaved, onCancel }: {
  client: SupabaseClient; memberId: string; initial?: CloudRoutine; onSaved: () => void; onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [goal, setGoal] = useState(initial?.goal ?? '')
  const [level, setLevel] = useState(initial?.level ?? '')
  const [days, setDays] = useState(initial?.days_per_week ?? 3)
  const [weeks, setWeeks] = useState(initial?.program_rounds ?? 24)
  const [blockWeeks, setBlockWeeks] = useState(initial?.block_rounds ?? 4)
  const [plan, setPlan] = useState<CloudPlan>(() => structuredClone(initial?.plan ?? cleanPlan()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ block: number; week: number; day: number; exercise: Exercise } | null>(null)

  const safeBlocks = Math.ceil(Math.min(104, Math.max(1, weeks || 1)) / Math.max(1, blockWeeks || 1))
  const planned = (day: number, block: number, week: number) => plannedExercises(plan, day, block, week, Math.max(1, blockWeeks), Math.max(1, weeks))
  function changeItems(block: number, week: number, day: number, items: Exercise[]) {
    setPlan(current => {
      const copy = structuredClone(current)
      if (week > 1) {
        copy.weekExercises ??= {}; copy.weekExercises[block] ??= {}; copy.weekExercises[block][week] ??= {}
        copy.weekExercises[block][week][day] = items
      } else if (block > 1) {
        copy.blockExercises ??= {}; copy.blockExercises[block] ??= {}; copy.blockExercises[block][day] = items
      } else { copy.exercisesByDay ??= {}; copy.exercisesByDay[day] = items }
      return copy
    })
  }
  function changeBlock(block: number, field: 'name' | 'warmup' | 'objective', value: string) {
    setPlan(current => ({ ...current, blockDetails: { ...current.blockDetails,
      [block]: { ...(current.blockDetails?.[block] ?? { name: '', warmup: '', objective: '' }), [field]: value } } }))
  }
  function changeGuidance(block: number, week: number, day: number, value: string) {
    setPlan(current => ({ ...current, sessionGuidance: { ...current.sessionGuidance,
      [block]: { ...current.sessionGuidance?.[block], [week]: { ...current.sessionGuidance?.[block]?.[week], [day]: value } } } }))
  }
  function changeComponents(block: number, week: number, day: number, items: { id: string; title: string; details: string }[]) {
    setPlan(current => ({ ...current, sessionComponents: { ...current.sessionComponents,
      [block]: { ...current.sessionComponents?.[block], [week]: { ...current.sessionComponents?.[block]?.[week], [day]: items } } } }))
  }
  function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing?.exercise.name.trim()) return
    const { block, week, day, exercise } = editing
    const current = planned(day, block, week)
    const normalized = { ...exercise, name: exercise.name.trim() }
    changeItems(block, week, day, current.some(item => item.id === exercise.id)
      ? current.map(item => item.id === exercise.id ? normalized : item)
      : [...current, normalized])
    setEditing(null)
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    if (!name.trim() || !level || !Number.isInteger(days) || days < 1 || days > 7 ||
      !Number.isInteger(weeks) || weeks < 1 || weeks > 104 || !Number.isInteger(blockWeeks) || blockWeeks < 1 || blockWeeks > weeks) {
      setError('Revisá el nombre, nivel, días y duración del programa.'); return
    }
    const trimmed: CloudPlan = structuredClone(plan)
    for (const day of Object.keys(trimmed.exercisesByDay ?? {})) if (+day > days) delete trimmed.exercisesByDay![day]
    for (const [block, items] of Object.entries(trimmed.blockExercises ?? {})) {
      if (+block > safeBlocks) { delete trimmed.blockExercises![block]; continue }
      for (const day of Object.keys(items)) if (+day > days) delete items[day]
    }
    for (const [block, entries] of Object.entries(trimmed.weekExercises ?? {})) {
      if (+block > safeBlocks) { delete trimmed.weekExercises![block]; continue }
      for (const [week, items] of Object.entries(entries)) {
        if (+week > Math.min(blockWeeks, weeks - (+block - 1) * blockWeeks)) { delete entries[week]; continue }
        for (const day of Object.keys(items)) if (+day > days) delete items[day]
      }
    }
    for (const block of Object.keys(trimmed.blockDetails ?? {})) if (+block > safeBlocks) delete trimmed.blockDetails![block]
    for (const field of ['sessionGuidance', 'sessionComponents'] as const) {
      for (const [block, entries] of Object.entries(trimmed[field] ?? {})) {
        if (+block > safeBlocks) { delete trimmed[field]![block]; continue }
        for (const [week, items] of Object.entries(entries as Record<string, Record<string, unknown>>)) {
          if (+week > Math.min(blockWeeks, weeks - (+block - 1) * blockWeeks)) { delete entries[week]; continue }
          for (const day of Object.keys(items)) if (+day > days) delete items[day]
        }
      }
    }
    setSaving(true); setError('')
    const row = { name: name.trim(), goal: goal.trim(), level, days_per_week: days, program_rounds: weeks, block_rounds: blockWeeks, plan: trimmed }
    const result = initial
      ? await client.from('routines').update(row).eq('id', initial.id).eq('member_id', memberId)
        .eq('plan', JSON.stringify(initial.plan)).select('id').maybeSingle()
      : await client.from('routines').insert({ ...row, id: crypto.randomUUID(), member_id: memberId }).select('id').maybeSingle()
    setSaving(false)
    if (result.error) { setError('No se pudo guardar la rutina. Revisá la conexión y los permisos.'); return }
    if (!result.data) { setError('La rutina cambió en otra sesión. Cerrá la ficha y volvé a abrirla antes de editar.'); return }
    onSaved()
  }
  return <section className="card form cloud-routine-editor">
    <div className="heading"><h2>{initial ? 'Editar rutina' : 'Crear rutina'}</h2><button className="secondary" type="button" disabled={saving} onClick={onCancel}>Cancelar</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    <form onSubmit={event => void save(event)}>
      <div className="grid">
        <label>Nombre de la rutina *<input required maxLength={120} value={name} onChange={event => setName(event.target.value)}/></label>
        <label>Objetivo<input maxLength={4000} value={goal} onChange={event => setGoal(event.target.value)}/></label>
        <label>Nivel *<select required value={level} onChange={event => setLevel(event.target.value)}><option value="">Seleccionar</option><option>Principiante</option><option>Intermedio</option><option>Avanzado</option></select></label>
        <label>Días por semana<select value={days} onChange={event => setDays(Number(event.target.value))}>{[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} {n === 1 ? 'día' : 'días'}</option>)}</select></label>
        <label>Semanas del programa *<input type="number" min="1" max="104" required value={weeks} onChange={event => setWeeks(Number(event.target.value))}/></label>
        <label>Semanas por bloque *<input type="number" min="1" max={weeks} required value={blockWeeks} onChange={event => setBlockWeeks(Number(event.target.value))}/></label>
      </div>
      <p className="muted">Abrí un bloque y una semana para ajustar cada día. Las semanas sin cambios mantienen la planificación anterior.</p>
      {Array.from({ length: safeBlocks }, (_, index) => index + 1).map(block =>
        <details key={block} className="editor-block"><summary>Bloque {block} · semanas {(block - 1) * blockWeeks + 1}–{Math.min(block * blockWeeks, weeks)}{plan.blockDetails?.[block]?.name ? ` · ${plan.blockDetails[block].name}` : ''}</summary>
          <div className="block-fields"><label>Nombre del bloque<input maxLength={120} value={plan.blockDetails?.[block]?.name ?? ''} onChange={event => changeBlock(block, 'name', event.target.value)}/></label>
            <label>Calentamiento específico<textarea maxLength={4000} value={plan.blockDetails?.[block]?.warmup ?? ''} onChange={event => changeBlock(block, 'warmup', event.target.value)}/></label></div>
          {Array.from({ length: Math.min(blockWeeks, weeks - (block - 1) * blockWeeks) }, (_, index) => index + 1).map(week =>
            <details key={week} className="editor-week"><summary>Semana {(block - 1) * blockWeeks + week}</summary>
              {Array.from({ length: days }, (_, index) => index + 1).map(day => {
                const items = planned(day, block, week)
                const components = plannedComponents(plan, day, block, week, blockWeeks, weeks)
                return <section className="day" key={day}><div className="heading"><h3>Día {day}</h3><button type="button" className="secondary" onClick={() => setEditing({ block, week, day, exercise: blankExercise() })}>+ Ejercicio</button></div>
                  {items.length === 0 && <p className="muted">Sin ejercicios todavía.</p>}
                  {items.map(item => <div className="exercise" key={item.id}><div><strong>{item.name}</strong><small>{item.sets || '—'} series · {item.reps || '—'} repeticiones · RIR {item.rir || '—'}</small></div>
                    <div className="actions"><button type="button" className="text-button" onClick={() => setEditing({ block, week, day, exercise: { ...item } })}>Editar</button>
                      <button type="button" className="text-button" onClick={() => changeItems(block, week, day, items.filter(ex => ex.id !== item.id))}>Eliminar</button></div></div>)}
                  <label>Indicaciones opcionales para este día<textarea maxLength={4000} value={plannedGuidance(plan, day, block, week, blockWeeks, weeks)} onChange={event => changeGuidance(block, week, day, event.target.value)}/></label>
                  <div className="heading"><h4>Componentes opcionales</h4><button type="button" className="secondary" onClick={() => changeComponents(block, week, day, [...components, { id: crypto.randomUUID(), title: '', details: '' }])}>+ Componente</button></div>
                  {components.map(component => <div key={component.id} className="grid"><label>Título<input maxLength={120} value={component.title} onChange={event => changeComponents(block, week, day, components.map(c => c.id === component.id ? { ...c, title: event.target.value } : c))}/></label>
                    <label>Contenido<textarea maxLength={4000} value={component.details} onChange={event => changeComponents(block, week, day, components.map(c => c.id === component.id ? { ...c, details: event.target.value } : c))}/></label>
                    <button type="button" className="secondary" onClick={() => changeComponents(block, week, day, components.filter(c => c.id !== component.id))}>Eliminar componente</button></div>)}
                </section>
              })}
            </details>)}
          <label>Objetivo y capacidades trabajadas en este bloque<textarea maxLength={4000} value={plan.blockDetails?.[block]?.objective ?? ''} onChange={event => changeBlock(block, 'objective', event.target.value)}/></label>
        </details>)}
      <button type="submit" disabled={saving}>{saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Guardar rutina'}</button>
    </form>
    {editing && <div className="overlay"><form className="card modal form" role="dialog" aria-modal="true" aria-label="Editar ejercicio" onSubmit={saveExercise}>
      <h2>{editing.exercise.name ? 'Editar' : 'Agregar'} ejercicio · Bloque {editing.block} · Semana {editing.week} · Día {editing.day}</h2>
      <div className="grid">{(['name','sets','reps','load','rir','rest','tempo'] as const).map(key => <label key={key}>{({ name:'Ejercicio *', sets:'Series', reps:'Repeticiones', load:'Carga', rir:'RIR', rest:'Descanso', tempo:'Tempo' })[key]}
        <input required={key === 'name'} maxLength={120} value={editing.exercise[key]} onChange={event => setEditing({ ...editing, exercise: { ...editing.exercise, [key]: event.target.value } })}/></label>)}</div>
      <label>Observaciones<textarea maxLength={4000} value={editing.exercise.notes} onChange={event => setEditing({ ...editing, exercise: { ...editing.exercise, notes: event.target.value } })}/></label>
      <div className="actions"><button type="submit">Guardar ejercicio</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button></div>
    </form></div>}
  </section>
}
