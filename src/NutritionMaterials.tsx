import { lazy, Suspense, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'

const FoodGuide = lazy(() => import('./AdminFoodGuide'))
const RecipeLibrary = lazy(() => import('./AdminRecipeLibrary'))
type Person = { id: string; first_name: string; last_name: string; user_id: string | null }

export function StudentNutritionMaterials() {
  return <section className="nutrition-materials" aria-label="Guías de alimentación habilitadas">
    <h2>Mis guías de alimentación</h2>
    <p>Consultá las guías del gimnasio por secciones.</p>
    <Suspense fallback={<p role="status">Cargando guías…</p>}><FoodGuide/><RecipeLibrary/></Suspense>
  </section>
}

export default function NutritionMaterials({ client }: { client: SupabaseClient }) {
  const [people, setPeople] = useState<Person[]>([])
  const [member, setMember] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true); setError('')
    void readAllPages((a, b) => client.from('members').select('id,first_name,last_name,user_id', { count: 'exact' }).order('last_name').order('id').range(a, b))
      .then(result => { if (!active) return; if (result.error) throw result.error; setPeople(result.data as Person[]) })
      .catch(() => { if (active) setError('No se pudo cargar la lista de socios. Volvé a intentar.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [client, open, revision])
  const person = people.find(item => item.id === member)
  async function send() {
    if (busy || loading || !person?.user_id) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await client.rpc('enable_personal_nutrition', { p_member: person.id })
      if (result.error) throw result.error
      setMessage(`Guías habilitadas para ${person.first_name} ${person.last_name}. Puede verlas en Alimentación saludable. Su dieta personalizada no se modificó.`)
    } catch { setError('No se pudo confirmar el envío. Podés reintentar: no se duplican las guías.') }
    finally { setBusy(false) }
  }
  return <details className="card nutrition-materials" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><strong>Enviar guías de alimentación al alumno</strong></summary>
    {open && <>
      <p>Habilitá los materiales ya preparados, sin completar la calculadora.</p>
      <p>Incluye <strong>GNS · Alimentación saludable</strong> y <strong>Recetario GNS</strong>. Se consultan dentro de la app, sin botón de descarga.</p>
      <label>Alumno destinatario<select value={member} disabled={busy || loading} onChange={event => { setMember(event.target.value); setMessage(''); setError('') }}>
        <option value="">Seleccioná un socio</option>
        {people.map(item => <option key={item.id} value={item.id}>{item.last_name}, {item.first_name}</option>)}
      </select></label>
      {loading && <p role="status">Cargando socios…</p>}
      {person && !person.user_id && <p>Primero vinculá la cuenta del alumno desde su ficha en Socios.</p>}
      <div className="actions"><button type="button" disabled={busy || loading || !person?.user_id} onClick={() => void send()}>{busy ? 'Enviando…' : 'Enviar guías al panel del alumno'}</button>
        <button type="button" className="secondary" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Actualizar socios</button></div>
      <p className="muted">Habilita el acceso a Nutrición; no registra un pago. Podés retirarlo desde Solicitudes de Nutrición.</p>
      {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    </>}
  </details>
}
