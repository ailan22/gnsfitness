import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'
import HealthFormFields from './HealthFormFields'
import HealthPrint from './HealthPrint'
import { blankHealthDraft, validateHealthDraft, type HealthDraft } from './healthRecords'
import { healthFields, healthTitles, sameHealthContent, type HealthKind, type HealthRecord } from './healthRecords'

type Person = { id: string; first_name: string; last_name: string; birth_date: string | null }
const displayDate = (value: string) => value.slice(0, 10).split('-').reverse().join('/')
export default function CloudHealth({ client, mode, initialMemberId = '', onDirtyChange, onNewPerson, embedded = false }: {
  client: SupabaseClient; mode: 'intake' | 'physio'; initialMemberId?: string; onDirtyChange: (dirty: boolean) => void; onNewPerson?: () => void; embedded?: boolean
}) {
  const [people, setPeople] = useState<Person[]>([])
  const [memberId, setMemberId] = useState(initialMemberId)
  const [search, setSearch] = useState('')
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [printRecords, setPrintRecords] = useState<HealthRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [peopleLoading, setPeopleLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [kind, setKind] = useState<HealthKind>(mode === 'intake' ? 'training_intake' : 'physio_assessment')
  const [draft, setDraft] = useState<HealthDraft | null>(null)
  const [episodeId, setEpisodeId] = useState('')
  const [correction, setCorrection] = useState<HealthRecord | null>(null)
  const [reason, setReason] = useState('')
  const [revision, setRevision] = useState(0)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)
  const [dirty, setDirty] = useState(false)
  const requestId = useRef(crypto.randomUUID())
  const busy = useRef(false)
  const person = people.find(item => item.id === memberId)
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const result = await readAllPages((from, to) => client.from('members').select('id,first_name,last_name,birth_date', { count: 'exact' }).order('last_name').order('id').range(from, to))
        if (!active) return
        if (result.error) throw result.error
        setPeople(result.data as Person[])
      } catch { if (active) setError('No se pudo cargar la lista de personas. Volvé a intentar.') }
      finally { if (active) setPeopleLoading(false) }
    })()
    return () => { active = false }
  }, [client, revision])
  useEffect(() => {
    let active = true
    void (async () => {
      setRecords([]); setLoading(true); setError('')
      try {
        if (!memberId) return
        const result = await readAllPages((from, to) => client.from('health_records').select('*', { count: 'exact' }).eq('member_id', memberId)
          .in('kind', mode === 'intake' ? ['training_intake'] : ['physio_assessment', 'physio_followup'])
          .order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to))
        if (!active) return
        if (result.error) throw result.error
        setRecords(result.data as HealthRecord[])
      } catch { if (active) setError('No se pudo consultar el registro privado. Reintentá; si persiste, falta habilitar este módulo o verificar tu acceso.') }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [client, memberId, mode, revision])
  const discard = () => !dirty || window.confirm('Hay información sin guardar. ¿Querés descartarla?')
  function begin(nextKind: HealthKind, source?: HealthRecord, episode?: string) {
    if (!discard()) return
    setKind(nextKind); setDraft(source ? { occurred_on: source.occurred_on, professional: source.professional, registration: source.registration, payload: { ...source.payload } } : blankHealthDraft())
    setCorrection(source ?? null); setReason(''); setEpisodeId(source?.episode_id ?? episode ?? '')
    requestId.current = crypto.randomUUID(); setDirty(Boolean(source)); setError(''); setMessage('')
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft || !person || busy.current) return
    const invalid = validateHealthDraft(kind, draft)
    if (invalid || (correction && !reason.trim()) || (kind === 'physio_followup' && !episodeId)) {
      setError(invalid ?? (correction && !reason.trim() ? 'Indicá el motivo de la rectificación.' : 'Seleccioná la evaluación inicial.')); return
    }
    busy.current = true; setSaving(true); setError('')
    try {
      const row = { id: requestId.current, member_id: memberId, kind, ...draft, professional: draft.professional.trim(),
        episode_id: kind === 'physio_followup' ? episodeId : null, correction_of: correction?.id ?? null, correction_reason: correction ? reason.trim() : '' }
      const result = await client.from('health_records').insert(row).select('id').single()
      if (result.error) {
        // Resolve a lost response without creating a duplicate clinical entry.
        const existing = await client.from('health_records').select('*').eq('id', requestId.current).maybeSingle()
        if (existing.error || !existing.data) throw result.error
        if (!sameHealthContent(existing.data, row)) { setMessage('El primer intento sí quedó guardado, con contenido anterior. Cancelá este formulario y rectificá el registro desde el historial para conservar los cambios posteriores.'); setRevision(value => value + 1); return }
      }
      setDraft(null); setDirty(false); setPage(0); setRevision(value => value + 1)
      setMessage('Registro guardado. Las rectificaciones conservan el original en el historial.')
    } catch { setError('No se pudo confirmar el guardado. Conservamos lo escrito: revisá tu conexión y reintentá. Si otra sesión ya rectificó este registro, actualizá el historial antes de continuar.') }
    finally { busy.current = false; setSaving(false) }
  }
  const superseded = new Set(records.flatMap(row => row.correction_of ? [row.correction_of] : []))
  const assessments = records.filter(row => row.kind === 'physio_assessment' && !superseded.has(row.id))
  const query = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const matches = people.filter(item => `${item.first_name} ${item.last_name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query))
  return <section className="health-workspace" aria-label={mode === 'intake' ? 'Anamnesis inicial de salud y entrenamiento' : 'Kinesiología'}>
    {printRecords && person && <HealthPrint name={`${person.first_name} ${person.last_name}`} memberId={memberId} records={printRecords} superseded={superseded} onClose={() => setPrintRecords(null)}/>}
    {!embedded && <div className="heading"><div><p className="eyebrow">ATENCIÓN PERSONAL · ACCESO PRIVADO</p><h1>{mode === 'intake' ? 'Salud y entrenamiento' : 'Kinesiología'}</h1><p className="muted">{mode === 'intake' ? 'Una evaluación inicial clara para acompañar cada objetivo.' : 'Evaluación, atención y evolución en un mismo lugar.'}</p></div><span className="privacy-badge">Solo administrador</span></div>}
    {!embedded && <div className="card health-person-picker"><div className="grid"><label>Buscar persona<input type="search" placeholder="Nombre o apellido" value={search} onChange={e => setSearch(e.target.value)} disabled={saving}/></label>
      <label>Ficha de la persona<select value={memberId} disabled={saving || peopleLoading} onChange={e => {
        if (!discard()) return
        setMemberId(e.target.value); setDraft(null); setDirty(false); setMessage(''); setPage(0)
      }}><option value="">{peopleLoading ? 'Cargando personas…' : 'Seleccionar una persona…'}</option>{people.filter(item => matches.includes(item) || item.id === memberId).map(item => <option key={item.id} value={item.id}>{item.last_name}, {item.first_name}{item.birth_date ? ` · ${displayDate(item.birth_date)}` : ''} · {item.id.slice(0, 6)}</option>)}</select></label></div>
      <p className="muted">Usá la ficha existente, incluso si la persona no tiene un plan del gimnasio. <button className="text-button" type="button" onClick={onNewPerson} disabled={saving}>Registrar persona</button></p>
    </div>}
    {error && <div className="error" role="alert">{error} <button className="secondary" type="button" disabled={saving} onClick={() => setRevision(value => value + 1)}>Reintentar carga</button></div>}
    {message && <p role="status" className="success-message">{message}</p>}
    {!memberId ? <div className="workspace-empty"><span aria-hidden="true">＋</span><h2>Primero, elegí una persona</h2><p>Sus registros se mostrarán aquí. No se comparten con alumnos ni entrenadores.</p></div> : <>
      <div className="heading health-person-heading"><div><h2>{person?.first_name} {person?.last_name}</h2><p className="muted">{person?.birth_date ? `Nacimiento: ${displayDate(person.birth_date)}` : 'Nacimiento sin registrar'}</p></div>
        {!draft && <div className="actions"><button type="button" disabled={loading || Boolean(error) || !person} onClick={() => begin(mode === 'intake' ? 'training_intake' : 'physio_assessment')}>{mode === 'intake' ? 'Nueva anamnesis' : 'Nueva evaluación'}</button>
          {mode === 'physio' && <button type="button" className="secondary" disabled={loading || Boolean(error) || !assessments.length} onClick={() => begin('physio_followup')}>Registrar sesión</button>}</div>}
      </div>
      {draft && <form className="card clinical-form" onSubmit={e => void save(e)}><fieldset disabled={saving} className="plain-fieldset">
        <div className="heading"><h2>{correction ? 'Rectificar registro' : healthTitles[kind]}</h2><button type="button" className="secondary" onClick={() => { if (discard()) { setDraft(null); setDirty(false); setError('') } }}>Cancelar</button></div>
        {kind === 'physio_followup' && <label>Evaluación inicial *<select required disabled={Boolean(correction)} value={episodeId} onChange={e => { setEpisodeId(e.target.value); setDirty(true) }}><option value="">Elegir evaluación…</option>{records.filter(row => row.kind === 'physio_assessment' && (!superseded.has(row.id) || row.id === episodeId)).map(row => <option key={row.id} value={row.id}>{displayDate(row.occurred_on)} · {row.payload.region} · {row.id.slice(0, 6)}</option>)}</select></label>}
        {correction && <label>Motivo de la rectificación *<textarea required maxLength={1000} value={reason} onChange={e => { setReason(e.target.value); setDirty(true) }}/></label>}
        <HealthFormFields kind={kind} draft={draft} onChange={next => { setDraft(next); setDirty(true) }}/>
        <div className="form-save-bar"><span className="muted">{dirty ? 'Cambios sin guardar' : 'Completá la información necesaria'}</span><button type="submit">{saving ? 'Guardando…' : 'Guardar registro'}</button></div>
      </fieldset></form>}
      <div className="heading"><h2>Historial de atención</h2><span className="muted">{records.length} {records.length === 1 ? 'registro' : 'registros'}</span><button type="button" className="secondary" disabled={loading || Boolean(error) || !person || !records.length || Boolean(draft)} onClick={() => setPrintRecords(records)}>Imprimir {mode === 'intake' ? 'anamnesis' : 'kinesiología'}</button></div>
      {loading ? <p role="status">Cargando historial…</p> : !records.length && !error ? <div className="card empty">Todavía no hay registros. Empezá con {mode === 'intake' ? 'la anamnesis inicial' : 'una evaluación inicial'}.</div> : <div className="clinical-timeline">{records.slice(page * 10, page * 10 + 10).map(row => <details className="card clinical-record" key={row.id}><summary><span><strong>{healthTitles[row.kind]}</strong><small>{displayDate(row.occurred_on)} · {row.professional}{row.payload.region ? ` · ${row.payload.region}` : ''}</small></span><span className="badge">{superseded.has(row.id) ? 'Rectificado' : row.correction_of ? 'Rectificación' : row.payload.status ?? 'Registrado'}</span></summary>
        <p className="muted">Registrado el {new Date(row.created_at).toLocaleString('es-UY')}{row.registration && ` · Registro profesional: ${row.registration}`}</p>
        {row.correction_reason && <p className="notice">Motivo de rectificación: {row.correction_reason}</p>}
        {row.episode_id && <p className="muted">Evaluación vinculada: {displayDate(records.find(item => item.id === row.episode_id)?.occurred_on ?? '')} · {row.episode_id.slice(0, 6)}</p>}
        <dl className="clinical-readout">{healthFields[row.kind].filter(field => row.payload[field.key]?.trim()).map(field => <div key={field.key}><dt>{field.label}</dt><dd>{row.payload[field.key]}</dd></div>)}</dl>
        <button type="button" className="secondary" disabled={loading || Boolean(error) || !person || Boolean(draft)} onClick={() => setPrintRecords([row])}>Imprimir este registro</button>
        {!superseded.has(row.id) && <button type="button" className="secondary" disabled={saving} onClick={() => begin(row.kind, row)}>Rectificar conservando original</button>}
      </details>)}</div>}
      {records.length > 10 && <nav className="actions" aria-label="Páginas del historial"><button className="secondary" disabled={!page} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page + 1} de {Math.ceil(records.length / 10)}</span><button className="secondary" disabled={(page + 1) * 10 >= records.length} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav>}
    </>}
  </section>
}
