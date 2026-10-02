import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'
import { serviceDates, type PlanServiceConfig } from './planServices'
import { uruguayToday } from './planReminders'
import { availableRoomTimes, roomTime } from './roomSchedule'
import { useRoomAvailability } from './useRoomAvailability'
type Person={id:string;first_name:string;last_name:string}
type Plan={id:string;member_id:string;service_config:PlanServiceConfig|null}
export default function HolisticSchedule({client,onOpen}:{client:SupabaseClient;onOpen:(id:string)=>void}) {
 const [month,setMonth]=useState(()=>uruguayToday().slice(0,7))
 const [date,setDate]=useState(uruguayToday)
 const [person,setPerson]=useState('')
 const [kind,setKind]=useState('reiki')
 const [time,setTime]=useState('')
 const [people,setPeople]=useState<Person[]>([])
 const [plans,setPlans]=useState<Plan[]>([])
 const [loaded,setLoaded]=useState(false)
 const [revision,setRevision]=useState(0)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [now,setNow]=useState(Date.now)
 useEffect(()=>{const tick=()=>setNow(Date.now());const timer=setInterval(tick,30000);window.addEventListener('focus',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick)}},[])
 const request=useRef(crypto.randomUUID()),busy=useRef(false)
 const room=useRoomAvailability(client,revision)
 useEffect(()=>{let active=true;void(async()=>{
  try {
   const [members,memberships]=await Promise.all([
    readAllPages((a,b)=>client.from('members').select('id,first_name,last_name',{count:'exact'}).order('last_name').order('id').range(a,b)),
    readAllPages((a,b)=>client.from('memberships').select('id,member_id,service_config',{count:'exact'}).order('id').range(a,b)),
   ])
   if(members.error||memberships.error)throw new Error('load')
   if(active){setPeople(members.data as Person[]);setPlans(memberships.data as Plan[]);setLoaded(true)}
  }catch{if(active){setLoaded(false);setError('No se pudo cargar la agenda completa. Actualizá para continuar.')}}
 })();return()=>{active=false}},[client,revision])
 const pending=plans.filter(p=>p.service_config?.physioDates.includes(date)&&!room.appointments.some(a=>a.membership_id===p.id&&a.session_date===date&&!a.cancelled))
 const times=availableRoomTimes(date,room.appointments).filter(t=>Date.parse(`${date}T${t}:00-03:00`)>now)
 const days=serviceDates(month,[0,1,2,3,4,5,6],`${month}-01`,`${month}-31`.replace(/31$/,String(new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate())))
 const name=(id:string)=>{const p=people.find(p=>p.id===id);return p?`${p.first_name} ${p.last_name}`:'Persona registrada'}
 async function save(event:FormEvent){
  event.preventDefault();if(busy.current||!loaded||room.loading||room.error||pending.length||!times.includes(time))return
  busy.current=true;setSaving(true);setError('');setMessage('')
  try{
   const result=await client.rpc('book_holistic_session',{p_id:request.current,p_member:person,p_kind:kind,p_date:date,p_time:time})
   if(result.error)throw new Error('save')
   setMessage('Sesión agendada. La sala quedó reservada durante 35 minutos.');setTime('');request.current=crypto.randomUUID();setRevision(v=>v+1)
  }catch{setError('No se confirmó la reserva. Actualizá y comprobá si ya aparece; puede haber otro turno o una sesión de kinesiología pendiente de horario.')}
  finally{busy.current=false;setSaving(false)}
 }
 async function cancel(id:string){
  if(busy.current||!window.confirm('¿Cancelar esta sesión y liberar sus 35 minutos en la sala?'))return
  busy.current=true;setSaving(true);setError('')
  try{const result=await client.rpc('cancel_holistic_session',{p_id:id});if(result.error)throw new Error('cancel');setMessage('Sesión cancelada. Horario liberado.');setRevision(v=>v+1)}catch{setError('No se pudo confirmar la cancelación. Actualizá la agenda.')}
  finally{busy.current=false;setSaving(false)}
 }
 return <section className="card holistic-schedule"><div className="heading"><h2 className="holistic-title">Terapias holísticas</h2><button className="secondary" type="button" disabled={saving} onClick={()=>{setError('');setRevision(v=>v+1)}}>Actualizar agenda</button></div>
  <div className="therapy-choices" aria-label="Elegir terapia">{[['reiki','Reiki'],['akashic','Registros Akáshicos']].map(([value,label])=><button type="button" key={value} aria-pressed={kind===value} className={kind===value?'therapy-choice active':'therapy-choice'} disabled={saving} onClick={()=>setKind(value)}>{label}</button>)}</div><p className="therapy-duration">35 minutos por sesión</p>
  {(error||room.error)&&<p className="error" role="alert">{error||room.error}</p>}{message&&<p role="status">{message}</p>}
  <form onSubmit={e=>void save(e)}><fieldset disabled={saving||!loaded||room.loading||Boolean(room.error)} className="plain-fieldset">
   <div className="grid"><label>Persona<select required value={person} onChange={e=>setPerson(e.target.value)}><option value="">Elegir persona</option>{people.map(p=><option key={p.id} value={p.id}>{name(p.id)}</option>)}</select></label>
   
   <label>Mes<input type="month" required value={month} min={uruguayToday().slice(0,7)} onChange={e=>{setMonth(e.target.value);setDate(e.target.value===uruguayToday().slice(0,7)?uruguayToday():`${e.target.value}-01`);setTime('')}}/></label></div>
   <div className="room-month" aria-label="Días del mes">{days.map(d=><button type="button" key={d} disabled={d<uruguayToday()} className={date===d?'active':'secondary'} aria-pressed={date===d} onClick={()=>{setDate(d);setTime('')}}>{d.slice(8)}</button>)}</div>
   <details className="member-compact"><summary>{date.split('-').reverse().join('/')} · Elegir horario disponible</summary>
    {pending.length?<><p>Hay {pending.length} sesión(es) de kinesiología sin hora. Asignales un horario antes de reservar terapias este día.</p>{pending.map(p=><button key={p.id} type="button" className="text-button" onClick={()=>onOpen(p.member_id)}>Abrir ficha de {name(p.member_id)}</button>)}</>:<label>Hora de inicio<select required value={time} onChange={e=>setTime(e.target.value)}><option value="">Seleccionar hora</option>{times.map(t=><option key={t}>{t}</option>)}</select></label>}
    <p>Los horarios que se cruzan con otra sesión no aparecen.</p>
   </details>
   <button type="submit" disabled={saving||pending.length>0||!time||!person}>{saving?'Guardando…':'Agendar sesión'}</button>
  </fieldset></form>
  <h3>Sesiones del mes</h3>{room.appointments.filter(a=>a.kind!=='physio'&&a.session_date.startsWith(month)).map(a=><article className="room-booking" key={a.id}><strong>{name(a.member_id)} · {a.kind==='reiki'?'Reiki':'Registros Akáshicos'}</strong><p>{a.session_date.split('-').reverse().join('/')} · {roomTime(a.starts_at)}–{roomTime(a.ends_at)}</p><button className="text-button" type="button" disabled={saving} onClick={()=>void cancel(a.id)}>Cancelar sesión</button></article>)}
 </section>
}
