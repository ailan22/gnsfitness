import { activeRehabByMember, type RehabEntry } from './activeRehab'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
const CloudHealth = lazy(() => import('./CloudHealth'))
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'

type Person = { id: string; first_name: string; last_name: string; phone: string; email: string }
export default function PhysioDirectory({ client, onDirtyChange, onNewPerson }: { client: SupabaseClient; onDirtyChange: (dirty: boolean) => void; onNewPerson: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  const trackDirty = useCallback((value: boolean) => { setDirty(value); onDirtyChange(value) }, [onDirtyChange])
  const [people, setPeople] = useState<Person[]>([])
  const [entries, setEntries] = useState<RehabEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    void (async () => {
      setLoading(true); setError(false)
      try {
        const [persons, records] = await Promise.all([
          readAllPages((from, to) => client.from('members').select('id,first_name,last_name,phone,email', { count: 'exact' }).order('last_name').order('id').range(from, to)),
          readAllPages((from, to) => client.from('health_records').select('id,member_id,kind,occurred_on,created_at,episode_id,correction_of,payload', { count: 'exact' }).in('kind', ['physio_assessment', 'physio_followup']).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to)),
        ])
        if (!active) return
        if (persons.error || records.error) throw new Error('load')
        setPeople(persons.data as Person[]); setEntries(records.data as RehabEntry[])
      } catch { if (active) setError(true) }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [client, revision])
  const latest = activeRehabByMember(entries)
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const patients = people.filter(person => latest.has(person.id) && normalize(`${person.first_name} ${person.last_name} ${person.phone} ${person.email}`).includes(normalize(search)))
  const registered = new Set(entries.map(entry => entry.member_id))
  const files = people.filter(person => registered.has(person.id) && normalize(`${person.first_name} ${person.last_name} ${person.phone} ${person.email}`).includes(normalize(search)))
  if (selected !== null) return <section aria-label="Ficha de kinesiología">
    <button type="button" className="back" onClick={() => { if (dirty && !window.confirm('¿Descartar los cambios sin guardar?')) return; trackDirty(false); setSelected(null); setRevision(value => value + 1) }}>← Volver a Kinesiología</button>
    <Suspense fallback={<p role="status">Cargando ficha privada…</p>}><CloudHealth key={selected} client={client} mode="physio" initialMemberId={selected} onDirtyChange={trackDirty} onNewPerson={onNewPerson}/></Suspense>
  </section>
  return <section className="physio-directory" aria-label="Kinesiología">
    <div className="heading"><h2>Kinesiología</h2><button type="button" className="secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>Actualizar</button></div>
    <label>Buscar en kinesiología<input type="search" placeholder="Nombre, apellido, teléfono o correo" value={search} onChange={event => setSearch(event.target.value)}/></label>
    {loading ? <p role="status">Cargando personas atendidas…</p> : error ? <p className="error" role="alert">No se pudo consultar el listado privado. Reintentá con Actualizar.</p> : <>
      <details className="card member-compact"><summary><strong>Activos en kinesiología ({patients.length})</strong></summary>
        {!patients.length && <p>No hay rehabilitaciones activas que coincidan con la búsqueda.</p>}
        <div className="list">{patients.map(person => { const entry = latest.get(person.id)!; return <button className="list-item" type="button" key={person.id} onClick={() => setSelected(person.id)}>
          <span><strong>{person.first_name} {person.last_name}</strong><small>{person.phone || person.email || 'Sin contacto registrado'}</small><small>Última atención: {entry.occurred_on.split('-').reverse().join('/')}</small></span>
          <span className="badge">{entry.payload.status || 'Evaluación inicial'}</span><span aria-hidden="true">→</span>
        </button> })}</div>
      </details>
      <button type="button" className="card physio-files-toggle" aria-expanded={showFiles} onClick={() => setShowFiles(value => !value)}>Fichas registradas ({files.length}) {showFiles ? '▾' : '→'}</button>
      {showFiles && <section className="card" aria-label="Fichas registradas"><h3>Fichas de kinesiología</h3>
        {!files.length && <p>No hay fichas que coincidan con la búsqueda.</p>}
        <div className="list">{files.map(person => <button className="list-item" type="button" key={person.id} onClick={() => setSelected(person.id)}><strong>{person.first_name} {person.last_name}</strong><span>Ver ficha →</span></button>)}</div>
      </section>}
      <button type="button" className="secondary physio-create" onClick={() => setSelected('')}>Nueva ficha de kinesiología</button>
    </>}
  </section>
}
