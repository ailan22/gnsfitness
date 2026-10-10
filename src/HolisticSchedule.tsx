import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'
import { serviceDates, type PlanServiceConfig } from './planServices'
import { uruguayToday } from './planReminders'
import { availableRoomTimes, roomTime } from './roomSchedule'
import { useRoomAvailability } from './useRoomAvailability'
import './HolisticSchedule.css'
type Person={id:string;first_name:string;last_name:string}
type Plan={id:string;member_id:string;service_config:PlanServiceConfig|null}
function TherapyIcon({book=false}:{book?:boolean}) {
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{book?<><path d="M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z"/><path d="M5 8h4M15 8h4M5 12h4M15 12h4"/></>:<><path d="M12 20C5 18 3 14 4 9c4 0 7 4 8 11Zm0 0c7-2 9-6 8-11-4 0-7 4-8 11Z"/><path d="M12 16C8 11 9 6 12 3c3 3 4 8 0 13Z"/></>}</svg>
}
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
 const [showMonth,setShowMonth]=useState(false)
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
   setMessage(`${name(person)} · ${kind==='reiki'?'Reiki':'Registros Akáshicos'} · ${date.split('-').reverse().join('/')} a las ${time}. Reserva confirmada.`);setTime('');request.current=crypto.randomUUID();setRevision(v=>v+1)
  }catch{setError('No se confirmó la reserva. Actualizá y comprobá si ya aparece; puede haber otro turno o una sesión de kinesiología pendiente de horario.')}
  finally{busy.current=false;setSaving(false)}
 }
 async function cancel(id:string){
  if(busy.current||!window.confirm('¿Cancelar esta sesión y liberar sus 35 minutos en la sala?'))return
  busy.current=true;setSaving(true);setError('')
  try{const result=await client.rpc('cancel_holistic_session',{p_id:id});if(result.error)throw new Error('cancel');setMessage('Sesión cancelada. Horario liberado.');setRevision(v=>v+1)}catch{setError('No se pudo confirmar la cancelación. Actualizá la agenda.')}
  finally{busy.current=false;setSaving(false)}
 }
 const reservations=room.appointments.filter(a=>!a.cancelled&&a.kind!=='physio'&&(showMonth?a.session_date.startsWith(month):a.session_date===date)).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))
 const dayLabel=new Intl.DateTimeFormat('es-UY',{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${date}T12:00:00-03:00`))
 return <section className="card holistic-schedule">
  <div className="heading"><div><h2 className="holistic-title">Terapias holísticas</h2><p className="therapy-duration">35 minutos por sesión</p></div><button className="secondary" type="button" disabled={saving} onClick={()=>{setError('');setRevision(v=>v+1)}}>Actualizar agenda</button></div>
  {(error||room.error)&&<p className="error" role="alert">{error||room.error}</p>}{message&&<p className="holistic-confirmation" role="status">{message}</p>}
  <div className="holistic-columns">
   <form className="holistic-booking-panel" onSubmit={e=>void save(e)}><h3>Nueva reserva</h3><fieldset disabled={saving||!loaded||room.loading||Boolean(room.error)} className="plain-fieldset">
    <div className="therapy-choices" aria-label="Elegir terapia">{[['reiki','Reiki'],['akashic','Registros Akáshicos']].map(([value,label])=><button type="button" key={value} aria-pressed={kind===value} className={kind===value?'therapy-choice active':'therapy-choice'} onClick={()=>setKind(value)}><TherapyIcon book={value==='akashic'}/><span>{label}</span></button>)}</div>
    <label>Persona<select required value={person} onChange={e=>setPerson(e.target.value)}><option value="">Elegir persona</option>{people.map(p=><option key={p.id} value={p.id}>{name(p.id)}</option>)}</select></label>
    <label>Mes<input type="month" required value={month} min={uruguayToday().slice(0,7)} onChange={e=>{setMonth(e.target.value);setDate(e.target.value===uruguayToday().slice(0,7)?uruguayToday():`${e.target.value}-01`);setTime('')}}/></label>
    <div className="holistic-weekdays" aria-hidden="true">{['L','M','M','J','V','S','D'].map((d,i)=><span key={i}>{d}</span>)}</div>
    <div className="room-month" aria-label="Días del mes">{days.map((d,i)=><button type="button" key={d} style={i===0?{gridColumnStart:((new Date(`${d}T12:00:00-03:00`).getDay()+6)%7)+1}:undefined} disabled={d<uruguayToday()} className={date===d?'active':'secondary'} aria-label={d.split('-').reverse().join('/')} aria-pressed={date===d} onClick={()=>{setDate(d);setTime('')}}>{d.slice(8)}</button>)}</div>
    <p className="holistic-selected-date">{dayLabel}</p>
    {pending.length?<div className="holistic-empty"><p>Hay {pending.length} sesión(es) de kinesiología sin hora. Asignales un horario antes de reservar terapias este día.</p>{pending.map(p=><button key={p.id} type="button" className="text-button" onClick={()=>onOpen(p.member_id)}>Abrir ficha de {name(p.member_id)}</button>)}</div>:<div className="holistic-time-groups">{[['Mañana','08:00–12:00',8],['Tarde','16:00–20:00',16]].map(([label,hours,start])=>{
     const slots=availableRoomTimes(date,[]).filter(t=>Number(t.slice(0,2))>=Number(start)&&Number(t.slice(0,2))<Number(start)+4)
     return <div className="holistic-time-group" key={label}><h4>{label} <span>{hours}</span></h4><div className="holistic-time-slots">{slots.map(t=>{
      const past=Date.parse(`${date}T${t}:00-03:00`)<=now
      const available=times.includes(t)
      return <button type="button" key={t} className={time===t?'active':'secondary'} disabled={!available} aria-pressed={time===t} aria-label={`${t}${past?' · Horario pasado':!available?' · No disponible':''}`} title={past?'Horario pasado':!available?'No disponible':'Seleccionar horario'} onClick={()=>setTime(t)}>{t}</button>
     })}</div>{slots.every(t=>Date.parse(`${date}T${t}:00-03:00`)<=now)&&<small>Estos horarios ya pasaron. Elegí otro día para reservar.</small>}</div>
    })}<small>Los horarios atenuados no están disponibles.</small></div>}
    <button className="holistic-submit" type="submit" disabled={saving||pending.length>0||!times.includes(time)||!person}>{saving?'Guardando…':'Agendar sesión'}</button>
   </fieldset></form>
   <aside className="holistic-reservations" aria-label="Reservas de terapias"><div className="heading"><h3>{showMonth?'Reservas del mes':'Reservas del día'} <span className="holistic-count">{reservations.length}</span></h3><button className="text-button" type="button" aria-pressed={showMonth} onClick={()=>setShowMonth(v=>!v)}>{showMonth?'Ver el día':'Ver todo el mes'}</button></div><p className="holistic-selected-date">{showMonth?month.split('-').reverse().join('/'):dayLabel}</p>
    {room.loading?<p role="status">Cargando reservas…</p>:room.error?<p>No se pudo comprobar la agenda.</p>:!reservations.length?<p className="holistic-empty">No hay sesiones agendadas para {showMonth?'este mes':'este día'}.</p>:reservations.map(a=><article className="holistic-reservation" key={a.id}><div className="holistic-reservation-heading"><span className="holistic-therapy-icon"><TherapyIcon book={a.kind==='akashic'}/></span><div><h4>{name(a.member_id)}</h4><p>{a.kind==='reiki'?'Reiki':'Registros Akáshicos'}</p></div></div><p className="holistic-reservation-time">{a.session_date.split('-').reverse().join('/')} · <strong>{roomTime(a.starts_at)}–{roomTime(a.ends_at)}</strong></p><div className="holistic-reservation-actions"><button className="secondary" type="button" onClick={()=>onOpen(a.member_id)}>Ver ficha</button><button className="text-button" type="button" disabled={saving} onClick={()=>void cancel(a.id)}>Cancelar sesión</button></div></article>)}
   </aside>
  </div>
 </section>
}
