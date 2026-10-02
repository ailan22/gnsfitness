import { useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import PlanSessionSchedule from './PlanSessionSchedule'
import { PHYSIO_SESSION_PRICE, summarizeServiceDates, type PlanServiceConfig } from './planServices'
import { parseDay } from './membership'

type Plan = { id: string; starts_at: string; ends_at: string; price: number; service_config: PlanServiceConfig | null }
export default function AdditionalPhysioSessions({ client, plan, memberId, onSaved }: { client: SupabaseClient; plan: Plan; memberId: string; onSaved: () => void }) {
  const [times, setTimes] = useState<Record<string,string>>({})
  const [dates, setDates] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const config = plan.service_config
  if (!config || config.version !== 1 || !config.physioDates.length) return null
  const additional = [...new Set(dates)].filter(d => !config.physioDates.includes(d)).sort()
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!config || busy.current || !additional.length) return
    if (additional.some(d => !parseDay(d) || d < plan.starts_at || d > plan.ends_at)) { setError('Elegí fechas dentro de la vigencia de este plan.'); return }
    if (additional.some(d => !times[d])) { setError('Elegí la hora de cada sesión nueva.'); return }
    busy.current = true; setSaving(true); setError('')
    try {
      // One conditional UPDATE atomically changes dates and total. A stale copy cannot overwrite another booking.
      const { data, error: failure } = await client.from('memberships').update({
        service_config: { ...config, physioTimes: {...config.physioTimes,...Object.fromEntries(additional.map(d=>[d,times[d]]))}, physioDates: [...new Set([...config.physioDates, ...additional])].sort() },
        price: Math.round((Number(plan.price) + additional.length * config.physioSessionPrice) * 100) / 100,
      }).eq('id', plan.id).eq('member_id', memberId).eq('price', plan.price)
        .eq('starts_at', plan.starts_at).eq('ends_at', plan.ends_at).eq('service_config', JSON.stringify(config)).select('id').maybeSingle()
      if (failure || !data) { setError('No se confirmó el cambio. Cerrá y volvé a abrir la ficha para consultar las fechas actuales antes de reintentar.'); return }
      setDates([]); onSaved()
    } catch { setError('No se confirmó el guardado. Volvé a abrir la ficha y comprobá las fechas antes de reintentar.') }
    finally { busy.current = false; setSaving(false) }
  }
  const rate = config.physioSessionPrice ?? PHYSIO_SESSION_PRICE
  return <details className="member-compact"><summary>Agregar sesiones de kinesiología a este plan</summary>
    <form onSubmit={event => void save(event)}><fieldset disabled={saving} className="plain-fieldset">
      <p>Ya registradas: {summarizeServiceDates(config.physioDates)}.</p>
      <PlanSessionSchedule start={plan.starts_at} end={plan.ends_at} client={client} times={times} onTimesChange={setTimes} dates={additional} lockedDates={config.physioDates} onChange={setDates}/>
      <p>{additional.length} sesión(es) nueva(s) × ${rate}. Adicional: <strong>${additional.length * rate}</strong>.</p>
      <p>Nuevo total del plan: ${Number(plan.price) + additional.length * rate}. Los pagos registrados se conservan.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={saving || !additional.length}>{saving ? 'Guardando…' : 'Guardar sesiones adicionales'}</button>
    </fieldset></form>
  </details>
}
