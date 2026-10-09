import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'
type Person = {id:string;first_name:string;last_name:string}
type Period = {id:string;member_id:string;plan_name:string;starts_at:string;ends_at:string}
export default function ExpiredMembers({client,date,onSelect}:{client:SupabaseClient;date:string;onSelect:(id:string)=>void}) {
 const [rows,setRows]=useState<(Person & {plan_name:string;ends_at:string})[]|null>(null),[error,setError]=useState(false)
 useEffect(()=>{let alive=true;void (async()=>{
  const [p,m]=await Promise.all([readAllPages<Period>((a,b)=>client.from('memberships').select('id,member_id,plan_name,starts_at,ends_at',{count:'exact'}).order('starts_at',{ascending:false}).order('id',{ascending:false}).range(a,b)),readAllPages<Person>((a,b)=>client.from('members').select('id,first_name,last_name',{count:'exact'}).order('id').range(a,b))])
  if(!alive)return;if(p.error||m.error){setError(true);return}
  const latest=new Map<string,Period>();for(const period of p.data??[])if(!latest.has(period.member_id))latest.set(period.member_id,period)
  setRows((m.data??[]).flatMap(person=>{const period=latest.get(person.id);return period&&period.ends_at<date?[{...person,plan_name:period.plan_name,ends_at:period.ends_at}]:[]}).sort((a,b)=>a.last_name.localeCompare(b.last_name)))
 })();return()=>{alive=false}},[client,date])
 return <div className="expired-member-list">{error?<p role="alert">No se pudo cargar la lista. Cerrá y volvé a abrir la flecha para reintentar.</p>:rows===null?<p role="status">Cargando vencidos…</p>:rows.length===0?<p>No hay planes vencidos.</p>:<ul>{rows.map(row=><li key={row.id}><button type="button" className="text-button" onClick={()=>onSelect(row.id)}>{row.first_name} {row.last_name}</button><small>{row.plan_name} · Venció {row.ends_at.split('-').reverse().join('/')}</small></li>)}</ul>}</div>
}
