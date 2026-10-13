import './PhysioCards.css'
import { useRoomAvailability } from './useRoomAvailability'
import { roomTime } from './roomSchedule'
import { uruguayToday } from './planReminders'
import { activeRehabByMember, type RehabEntry } from './activeRehab'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
const CloudHealth = lazy(() => import('./CloudHealth'))
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'

type Person = { id: string; first_name: string; last_name: string; phone: string; email: string }
export default function PhysioDirectory({ client, onDirtyChange, onNewPerson, onOpenMember }: { client: SupabaseClient; onDirtyChange: (dirty: boolean) => void; onNewPerson: () => void; onOpenMember: (id: string) => void }) {
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
  const room = useRoomAvailability(client, revision)
  const [date, setDate] = useState(uruguayToday)
  const [period, setPeriod] = useState<'morning'|'afternoon'>('morning')
  const [page, setPage] = useState(0)
  const [booking, setBooking] = useState(false)
  const [bookingPerson, setBookingPerson] = useState('')
  function shiftDate(delta: number) { const day=new Date(date+'T12:00:00-03:00'); day.setUTCDate(day.getUTCDate()+delta); setDate(day.toISOString().slice(0,10)) }
  const latest = activeRehabByMember(entries)
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const patients = people.filter(person => latest.has(person.id) && normalize(`${person.first_name} ${person.last_name} ${person.phone} ${person.email}`).includes(normalize(search)))
  const registered = new Set(entries.map(entry => entry.member_id))
  const files = people.filter(person => registered.has(person.id) && normalize(`${person.first_name} ${person.last_name} ${person.phone} ${person.email}`).includes(normalize(search)))
  if (selected !== null) return <section aria-label="Ficha de kinesiología">
    <button type="button" className="back" onClick={() => { if (dirty && !window.confirm('¿Descartar los cambios sin guardar?')) return; trackDirty(false); setSelected(null); setRevision(value => value + 1) }}>← Volver a Kinesiología</button>
    <Suspense fallback={<p role="status">Cargando ficha privada…</p>}><CloudHealth key={selected} client={client} mode="physio" initialMemberId={selected} onDirtyChange={trackDirty} onNewPerson={onNewPerson}/></Suspense>
  </section>
  const list = showFiles ? files : patients
  const currentPage = Math.min(page, Math.max(0, Math.ceil(list.length / 6) - 1))
  const appointments = room.appointments.filter(a => !a.cancelled && a.kind === 'physio').sort((a,b)=>a.starts_at.localeCompare(b.starts_at))
  const dayRows = appointments.filter(a=>a.session_date===date && (period==='morning' ? Number(roomTime(a.starts_at).slice(0,2))<12 : Number(roomTime(a.starts_at).slice(0,2))>=12))
  const name = (id:string) => {const p=people.find(p=>p.id===id);return p ? p.first_name+' '+p.last_name : 'Persona registrada'}
  const initials = (p:Person) => (p.first_name[0]||'')+(p.last_name[0]||'')
  return <section className="physio-directory physio-cards-view" aria-label="Kinesiología">
    <div className="physio-cards-main">
      <div className="physio-cards-toolbar"><input aria-label="Buscar persona" type="search" placeholder="Buscar persona…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/><button type="button" className="secondary" onClick={()=>setSelected('')}>＋ Nueva ficha</button></div>
      <section className="physio-people-panel"><h2>Personas en atención</h2>
        <div className="physio-view-tabs" aria-label="Filtrar fichas"><button type="button" aria-pressed={!showFiles} onClick={()=>{setShowFiles(false);setPage(0)}}>Activos · {patients.length}</button><button type="button" aria-pressed={showFiles} onClick={()=>{setShowFiles(true);setPage(0)}}>Todas las fichas · {files.length}</button></div>
        {loading ? <p role="status">Cargando personas…</p> : error ? <p role="alert">No se pudo consultar el listado. <button type="button" onClick={()=>setRevision(v=>v+1)}>Reintentar</button></p> : <>
          {!list.length && <p className="physio-empty">No hay personas que coincidan con esta vista.</p>}
          <div className="physio-patient-grid">{list.slice(currentPage*6,currentPage*6+6).map(p=>{const next=appointments.find(a=>a.member_id===p.id&&Date.parse(a.starts_at)>=Date.now());return <button type="button" className="physio-patient-card" key={p.id} onClick={()=>setSelected(p.id)}>
            <span className="physio-initials" aria-hidden="true">{initials(p)}</span><span className="physio-patient-content"><strong>{name(p.id)}</strong><small>Próxima sesión</small><span>{room.loading?'Consultando…':room.error?'Agenda no disponible':next?next.session_date.split('-').reverse().join('/')+' · '+roomTime(next.starts_at):'Sin sesión agendada'}</span></span><span className="physio-card-open"><b aria-hidden="true">›</b><small>Ver ficha</small></span>
          </button>})}</div>
          <footer className="physio-pagination"><span>{list.length} {showFiles?'fichas registradas':'personas activas'}</span><nav aria-label="Páginas de pacientes"><button type="button" aria-label="Página anterior" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>‹</button><span>{currentPage+1}</span><button type="button" aria-label="Página siguiente" disabled={(currentPage+1)*6>=list.length} onClick={()=>setPage(currentPage+1)}>›</button></nav></footer>
        </>}
      </section>
    </div>
    <aside className="physio-agenda-panel" aria-label="Agenda de kinesiología"><div className="physio-agenda-heading"><h2>Agenda</h2><div className="physio-date-nav"><button type="button" aria-label="Día anterior" onClick={()=>shiftDate(-1)}>‹</button><input aria-label="Fecha de agenda" type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value)}}/><button type="button" aria-label="Día siguiente" onClick={()=>shiftDate(1)}>›</button></div></div>
      <div className="physio-view-tabs"><button type="button" aria-pressed={period==='morning'} onClick={()=>setPeriod('morning')}>Mañana</button><button type="button" aria-pressed={period==='afternoon'} onClick={()=>setPeriod('afternoon')}>Tarde</button></div>
      <div className="physio-agenda-rows">{room.loading?<p role="status">Cargando agenda…</p>:room.error?<p role="alert">No se pudo consultar la agenda. <button type="button" onClick={()=>setRevision(v=>v+1)}>Reintentar</button></p>:!dayRows.length?<p className="physio-empty">No hay sesiones en este turno.</p>:dayRows.map(a=><button type="button" className="physio-agenda-row" key={a.id} onClick={()=>setSelected(a.member_id)}><span className="physio-time"><time>{roomTime(a.starts_at)}</time><time>{roomTime(a.ends_at)}</time></span><span>{name(a.member_id)}</span><b aria-hidden="true">›</b></button>)}</div>
      <button className="secondary physio-book-button" type="button" aria-expanded={booking} onClick={()=>setBooking(v=>!v)}>＋ Agendar sesión</button>
      {booking&&<div className="physio-book-person"><label>Persona<select value={bookingPerson} onChange={e=>setBookingPerson(e.target.value)}><option value="">Elegir persona</option>{people.map(p=><option key={p.id} value={p.id}>{name(p.id)}</option>)}</select></label><p>Elegí los días y horarios en el plan de kinesiología de su ficha.</p><button type="button" disabled={!bookingPerson} onClick={()=>onOpenMember(bookingPerson)}>Abrir plan y sesiones</button></div>}
      <small className="physio-session-duration">35 minutos por sesión</small>
    </aside>
  </section>
}
