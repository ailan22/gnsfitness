import { lazy, Suspense, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'

const FoodGuide = lazy(() => import('./AdminFoodGuide'))
const RecipeLibrary = lazy(() => import('./AdminRecipeLibrary'))
const guides = [{ id: 'food', title: 'GNS · Alimentación saludable' }, { id: 'recipes', title: 'Recetario GNS' }]
type Person = { id: string; first_name: string; last_name: string; user_id: string | null }
type Access = { member_id: string; status: string; nutrition_guides: string[] }

export function StudentNutritionMaterials({ assigned = [] }: { assigned?: string[] }) {
  if (!assigned.some(id => guides.some(guide => guide.id === id))) return null
  return <section className="nutrition-materials" aria-label="Guías de alimentación habilitadas">
    <h2>Mis guías de alimentación</h2>
    <p>Estas son las guías que el administrador habilitó para vos.</p>
    <Suspense fallback={<p role="status">Cargando guías…</p>}>{assigned.includes('food') && <FoodGuide/>}{assigned.includes('recipes') && <RecipeLibrary/>}</Suspense>
  </section>
}

export default function NutritionMaterials({ client, expanded=false }: { client: SupabaseClient; expanded?:boolean }) {
  const [people, setPeople] = useState<Person[]>([])
  const [access, setAccess] = useState<Access[]>([])
  const [member, setMember] = useState('')
  const [selected, setSelected] = useState<string[] | null>(null)
  const [open, setOpen] = useState(expanded)
  const [loading, setLoading] = useState(expanded)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!open) return
    let active = true
    void Promise.all([
      readAllPages((a, b) => client.from('members').select('id,first_name,last_name,user_id', { count: 'exact' }).order('last_name').order('id').range(a, b)),
      readAllPages((a, b) => client.from('service_requests').select('member_id,status,nutrition_guides', { count: 'exact' }).eq('service', 'nutrition').order('id').range(a, b)),
    ]).then(([members, requests]) => {
      if (!active) return
      if (members.error || requests.error) throw members.error || requests.error
      setPeople(members.data as Person[]); setAccess(requests.data as Access[]); setLoadFailed(false)
    }).catch(() => { if (active) { setLoadFailed(true); setError('No se pudieron cargar las asignaciones. Actualizá antes de enviar.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [client, open, revision])
  const person = people.find(item => item.id === member)
  const request = access.find(item => item.member_id === member)
  const saved = request?.nutrition_guides ?? []
  const chosen = selected ?? saved
  const eligible = request?.status === 'pending' || request?.status === 'enabled'
  async function send() {
    if (busy || loading || loadFailed || !person?.user_id || !eligible) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await client.rpc('assign_nutrition_guides', { p_member: person.id, p_guides: chosen, p_expected: saved })
      if (result.error) throw result.error
      const next = [...chosen].sort()
      setAccess(rows => rows.map(row => row.member_id === member ? { ...row, nutrition_guides: next, status: next.length ? 'enabled' : row.status } : row)); setSelected(null)
      setMessage(next.length ? `Selección guardada para ${person.first_name}: ${guides.filter(g => next.includes(g.id)).map(g => g.title).join(' y ')}.` : `Se retiraron las guías de ${person.first_name}. Su dieta personalizada no se modificó.`)
    } catch { setError('No se pudo guardar. Actualizá las asignaciones y revisá la selección antes de reintentar.') }
    finally { setBusy(false) }
  }
  return <details open={open} className="card nutrition-materials" onToggle={event => { if(event.currentTarget.open===open)return; setOpen(event.currentTarget.open); setLoading(event.currentTarget.open); setSelected(null); setError('') }}>
    <summary><strong>Guías para compartir</strong></summary>
    {open && <>
      <p>Después de su solicitud, elegí qué guías habilitarle. La calculadora y la dieta personalizada se gestionan por separado.</p>
      <div className="nutrition-share-grid"><div className="nutrition-share-person"><h3>Socio destinatario</h3><label>Alumno destinatario<select value={member} disabled={busy || loading} onChange={event => { setMember(event.target.value); setSelected(null); setMessage(''); setError('') }}>
        <option value="">Seleccioná un socio</option>
        {people.map(item => <option key={item.id} value={item.id}>{item.last_name}, {item.first_name}</option>)}
      </select></label>
      {loading && <p role="status">Cargando asignaciones…</p>}
      {person && !person.user_id && <p>Primero vinculá la cuenta del alumno desde su ficha en Socios.</p>}
      {person?.user_id && !eligible && !loading && <p>El alumno todavía no tiene una solicitud pendiente o un acceso habilitado. Debe solicitar Nutrición desde Alimentación saludable.</p>}
      </div><div className="nutrition-share-guides"><h3>Guías para habilitar</h3>{!person&&<p>Seleccioná un socio para consultar y elegir sus guías.</p>}{person && eligible && <fieldset className="nutrition-guide-choices" disabled={busy || loading || loadFailed}>
        <legend>Guías para este alumno</legend>
        {guides.map(guide => <label key={guide.id}><input type="checkbox" checked={chosen.includes(guide.id)} onChange={event => { setSelected(event.target.checked ? [...chosen, guide.id] : chosen.filter(id => id !== guide.id)); setMessage('') }}/><span>{guide.title}</span></label>)}
      </fieldset>}</div></div>
      <div className="actions"><button type="button" disabled={busy || loading || loadFailed || !person?.user_id || !eligible} onClick={() => void send()}>{busy ? 'Guardando…' : 'Guardar guías seleccionadas'}</button>
        <button type="button" className="secondary" disabled={busy || loading} onClick={() => { setLoading(true); setSelected(null); setError(''); setRevision(value => value + 1) }}>Actualizar asignaciones</button></div>
      <p className="muted">Solo verá las guías marcadas. Para retirar una, desmarcala y guardá. No modifica su dieta ni registra pagos.</p>
      {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    </>}
  </details>
}
