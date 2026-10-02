import { useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRoomAvailability } from './useRoomAvailability'
import { availableRoomTimes } from './roomSchedule'
import type { PlanServiceConfig } from './planServices'
export default function PhysioRoomTimes({client,plan,memberId,onSaved}:{client:SupabaseClient;plan:{id:string;service_config:PlanServiceConfig|null};memberId:string;onSaved:()=>void}) {
  const [times,setTimes]=useState<Record<string,string>>({})
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const busy=useRef(false)
  const availability=useRoomAvailability(client)
  const config=plan.service_config
  async function save(event:FormEvent) {
    event.preventDefault();if(!config||busy.current||availability.loading||availability.error)return
    const merged={...config.physioTimes,...times}
    if(Object.values(merged).some(t=>!/^\d{2}:\d{2}$/.test(t))) {setError('Elegí un horario para cada fecha que modificaste.');return}
    busy.current=true;setSaving(true);setError('')
    try {
      const result=await client.from('memberships').update({service_config:{...config,physioTimes:merged}}).eq('id',plan.id).eq('member_id',memberId).eq('service_config',JSON.stringify(config)).select('id').maybeSingle()
      if(result.error||!result.data) {setError('No se confirmó el horario: la sala puede estar ocupada o la ficha cambió. Actualizá antes de reintentar.');return}
      setTimes({});onSaved()
    } catch {setError('No se confirmó el guardado. Actualizá la ficha y revisá los horarios.')}
    finally{busy.current=false;setSaving(false)}
  }
  if(!config?.physioDates.length)return null
  return <details className="member-compact"><summary>Horarios de kinesiología · sesiones de 35 minutos</summary>
    <form onSubmit={e=>void save(e)}><fieldset className="plain-fieldset" disabled={saving||availability.loading||Boolean(availability.error)}>
      {config.physioDates.map(date=><details className="room-day" key={date}><summary>{date.split('-').reverse().join('/')} · {times[date]||config.physioTimes?.[date]||'Sin hora asignada'}</summary>
        <label>Hora de la sesión<select value={times[date]??config.physioTimes?.[date]??''} onChange={e=>setTimes({...times,[date]:e.target.value})}><option value="">Elegir hora disponible</option>{availableRoomTimes(date,availability.appointments,plan.id).map(t=><option key={t}>{t}</option>)}</select></label>
      </details>)}
      <p>Los horarios ocupados por kinesiología o terapias holísticas no están disponibles. No cambia el precio ni los pagos.</p>
      <button disabled={!Object.keys(times).length||saving} type="submit">{saving?'Guardando…':'Guardar horarios'}</button>
    </fieldset>{(error||availability.error)&&<p className="error" role="alert">{error||availability.error}</p>}</form>
  </details>
}
