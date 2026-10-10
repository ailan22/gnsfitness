import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'
import { uruguayToday } from './planReminders'
import { roomTime, type RoomAppointment } from './roomSchedule'

export default function DashboardAgenda({client,revision,onOpen}:{client:SupabaseClient;revision:number;onOpen?:(id:string)=>void}) {
  const [rows,setRows]=useState<(RoomAppointment & {name:string})[]>([])
  const [date,setDate]=useState(uruguayToday)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    let active=true,busy=false
    async function load(){
      if(busy)return
      busy=true
      const day=uruguayToday()
      try{
        const result=await readAllPages((a,b)=>client.from('room_appointments').select('id,member_id,membership_id,kind,session_date,starts_at,ends_at,cancelled',{count:'exact'}).eq('session_date',day).eq('cancelled',false).order('starts_at').order('id').range(a,b))
        if(result.error)throw Error('agenda')
        const appointments=(result.data||[]) as RoomAppointment[]
        const ids=[...new Set(appointments.map(a=>a.member_id))]
        const people=ids.length?await readAllPages((a,b)=>client.from('members').select('id,first_name,last_name',{count:'exact'}).in('id',ids).order('id').range(a,b)):{data:[],error:null}
        if(people.error)throw Error('people')
        const names=new Map((people.data||[]).map(p=>[p.id,`${p.first_name} ${p.last_name}`]))
        if(active){setRows(appointments.map(a=>({...a,name:names.get(a.member_id)||'Persona registrada'})));setDate(day);setError('')}
      }catch{if(active){setRows([]);setError('No se pudo cargar la agenda. Volvé a actualizar.')}}
      finally{busy=false;if(active)setLoading(false)}
    }
    const first=setTimeout(()=>void load(),0)
    const refresh=()=>{if(document.visibilityState==='visible')void load()}
    const timer=setInterval(refresh,30000)
    window.addEventListener('focus',refresh)
    return()=>{active=false;clearTimeout(first);clearInterval(timer);window.removeEventListener('focus',refresh)}
  },[client,revision])
  return <section className="card dashboard-agenda" aria-label="Agenda de hoy"><div className="heading"><h2>Agenda de hoy</h2><time dateTime={date}>{new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Montevideo'}).format(new Date(`${date}T12:00:00-03:00`))}</time></div>
    {loading?<p role="status">Cargando agenda…</p>:error?<p role="alert">{error}</p>:rows.length===0?<p className="muted">No hay sesiones con horario agendadas para hoy.</p>:<ul>{rows.map(row=><li key={row.id}><button type="button" onClick={()=>onOpen?.(row.member_id)}><time>{roomTime(row.starts_at)}</time><span><strong>{row.name}</strong><small>{row.kind==='physio'?'Kinesiología':row.kind==='reiki'?'Reiki':'Registros akáshicos'}</small></span><span aria-hidden="true">›</span></button></li>)}</ul>}
  </section>
}
