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

export default function NutritionMaterials({ client }: { client: SupabaseClient }) {
  const [people, setPeople] = useState<Person[]>([])
  const [access, setAccess] = useState<Access[]>([])
  const [member, setMember] = useState('')
  const [selected, setSelected] = useState<string[] | null>(null)
  const open = true
  const [loading, setLoading] = useState(true)
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
  return <section className="card nutrition-materials nutrition-share-panel" aria-label="Guías para compartir">
    <header className="nutrition-share-heading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z"/></svg><div><h3>Guías para compartir</h3><p>Seleccioná las guías que querés habilitar para un socio.</p></div></header>
    <div className="nutrition-share-grid">
      <div className="nutrition-share-guides"><h4>1. Seleccioná las guías</h4><fieldset className="nutrition-guide-choices" aria-label="Guías para este alumno" disabled={busy || loading || loadFailed || Boolean(person&&!eligible)}>
        {guides.map(guide=><label key={guide.id}><input type="checkbox" checked={chosen.includes(guide.id)} onChange={event=>{setSelected(event.target.checked?[...chosen,guide.id]:chosen.filter(id=>id!==guide.id));setMessage('')}}/><span><strong>{guide.id==='food'?'Alimentación saludable':guide.title}</strong><small>{guide.id==='food'?'Principios, hábitos y recomendaciones.':'Recetas organizadas para cada comida.'}</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 2h9l5 5v15H5ZM14 2v6h5"/></svg></label>)}
      </fieldset></div>
      <div className="nutrition-share-person"><h4>2. Asigná al socio</h4><label>Seleccioná un socio existente.<select value={member} disabled={busy||loading} onChange={event=>{setMember(event.target.value);if(member)setSelected(null);setMessage('');setError('')}}><option value="">Seleccioná un socio</option>{people.map(item=><option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}</select></label>
        <div className="nutrition-selection-status"><span aria-hidden="true">✓</span><div><strong>{chosen.length} {chosen.length===1?'guía seleccionada':'guías seleccionadas'}</strong><p>{person?`La selección se guardará para ${person.first_name} ${person.last_name}.`:'Elegí el destinatario para continuar.'}</p></div></div>
        {loading&&<p role="status">Cargando asignaciones…</p>}
        {person&&!person.user_id&&<p>Primero vinculá la cuenta del alumno desde su ficha.</p>}
        {person?.user_id&&!eligible&&!loading&&<p>El alumno debe solicitar acceso a Nutrición antes de habilitar sus guías.</p>}
        <div className="nutrition-share-actions"><button type="button" disabled={busy||loading||loadFailed||!person?.user_id||!eligible} onClick={()=>void send()}>{busy?'Guardando…':chosen.length===0?'Guardar selección':chosen.length===1?'Habilitar guía':'Habilitar guías'} <span aria-hidden="true">›</span></button><button type="button" className="text-button" disabled={busy||loading} onClick={()=>{setLoading(true);setSelected(null);setError('');setRevision(v=>v+1)}}>Actualizar asignaciones</button></div>
      </div>
    </div>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
  </section>
}
