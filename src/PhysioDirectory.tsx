import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'

type Person = { id: string; first_name: string; last_name: string; phone: string; email: string }
type Entry = { id: string; member_id: string; occurred_on: string; correction_of: string | null; payload: Record<string, string> }
export default function PhysioDirectory({ client, onOpen }: { client: SupabaseClient; onOpen: (id: string) => void }) {
  const [people, setPeople] = useState<Person[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
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
          readAllPages((from, to) => client.from('health_records').select('id,member_id,occurred_on,correction_of,payload', { count: 'exact' }).in('kind', ['physio_assessment', 'physio_followup']).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to)),
        ])
        if (!active) return
        if (persons.error || records.error) throw new Error('load')
        setPeople(persons.data as Person[]); setEntries(records.data as Entry[])
      } catch { if (active) setError(true) }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [client, revision])
  const superseded = new Set(entries.flatMap(entry => entry.correction_of ? [entry.correction_of] : []))
  const latest = new Map<string, Entry>()
  entries.filter(entry => !superseded.has(entry.id)).forEach(entry => { if (!latest.has(entry.member_id)) latest.set(entry.member_id, entry) })
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const patients = people.filter(person => latest.has(person.id) && normalize(`${person.first_name} ${person.last_name} ${person.phone} ${person.email}`).includes(normalize(search)))
  return <section className="card physio-directory" aria-label="Personas atendidas en kinesiología">
    <div className="heading"><div><h2>Personas atendidas en kinesiología</h2><p className="muted">Abrí una ficha para consultar sus datos, evaluaciones y sesiones. El estado corresponde al último registro.</p></div><button type="button" className="secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>Actualizar</button></div>
    <label>Buscar en kinesiología<input type="search" placeholder="Nombre, apellido, teléfono o correo" value={search} onChange={event => setSearch(event.target.value)}/></label>
    {loading ? <p role="status">Cargando personas atendidas…</p> : error ? <p className="error" role="alert">No se pudo consultar el listado privado. Reintentá con Actualizar.</p> : <>
      <p className="muted">{patients.length} personas</p>
      {!patients.length && <p>No hay personas con atención registrada que coincidan con la búsqueda. Podés iniciar una atención seleccionando una persona debajo.</p>}
      <div className="list">{patients.map(person => { const entry = latest.get(person.id)!; return <button className="list-item" type="button" key={person.id} onClick={() => onOpen(person.id)}>
        <span><strong>{person.first_name} {person.last_name}</strong><small>{person.phone || person.email || 'Sin contacto registrado'}</small><small>Última atención: {entry.occurred_on.split('-').reverse().join('/')}</small></span>
        <span className="badge">{entry.payload.status || 'Evaluación inicial'}</span><span aria-hidden="true">→</span>
      </button> })}</div>
    </>}
  </section>
}
