import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import NutritionMaterials from './NutritionMaterials'
import PersonalNutrition from './PersonalNutrition'
import AdminFoodGuide from './AdminFoodGuide'
import AdminRecipeLibrary from './AdminRecipeLibrary'
import {ServiceNotifications} from './StudentWellbeing'
import {readAllPages} from './readAllPages'
import './NutritionWorkspace.css'

type Section='guides'|'personal'|'tracking'
type Plan={member_id:string;title:string;active:boolean;published_at:string}
function NutritionTracking({client}:{client:SupabaseClient}) {
 const [rows,setRows]=useState<Plan[]>([]),[names,setNames]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 useEffect(()=>{let alive=true;void(async()=>{try{
  const [plans,members]=await Promise.all([
   readAllPages((a,b)=>client.from('nutrition_plans').select('member_id,title,active,published_at',{count:'exact'}).order('member_id').range(a,b)),
   readAllPages((a,b)=>client.from('members').select('id,first_name,last_name',{count:'exact'}).order('id').range(a,b)),
  ])
  if(plans.error||members.error||!plans.data||!members.data)throw Error()
  if(alive){setRows(plans.data as Plan[]);setNames(Object.fromEntries(members.data.map(m=>[m.id,`${m.first_name} ${m.last_name}`])))}
 }catch{if(alive)setError('No se pudo consultar el seguimiento. Volvé a actualizar.')}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[client,revision])
 return <section className="card"><div className="heading"><h3>Planes asignados</h3><button className="secondary" disabled={loading} onClick={()=>{setLoading(true);setError('');setRevision(v=>v+1)}}>Actualizar</button></div>{error?<p role="alert">{error}</p>:loading?<p role="status">Cargando planes…</p>:rows.length===0?<p>Todavía no hay planes enviados.</p>:<div className="nutrition-tracking-list">{rows.map(row=><article key={row.member_id}><div><strong>{names[row.member_id]??'Socio'}</strong><p>{row.title}</p></div><div><span>{row.active?'Publicado':'Retirado'}</span><p>{new Date(row.published_at).toLocaleDateString('es-UY')}</p></div></article>)}</div>}</section>
}
export default function NutritionWorkspace({client,onDirtyChange}:{client:SupabaseClient;onDirtyChange:(value:boolean)=>void}) {
 const [section,setSection]=useState<Section>('guides')
 const cards=[{id:'guides',title:'GUÍAS Y RECETARIOS',text:'Elegí qué compartir con cada socio',path:'M12 5v15 M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z'}, {id:'personal',title:'NUTRICIÓN PERSONALIZADA',text:'Calculadora y plan semanal',path:'M5 2h14v20H5z M8 5h8v4H8z M8 13h1 M12 13h1 M16 13h1 M8 17h1 M12 17h1 M16 17h1'}, {id:'tracking',title:'SEGUIMIENTO',text:'Planes asignados y revisión',path:'M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M4 22v-4a8 8 0 0 1 16 0v4Z'}] as const
 return <section className="nutrition-workspace"><div className="nutrition-workspace-heading"><div><h2>NUTRICIÓN</h2><p>Guías, planes y seguimiento de tus socios.</p></div><ServiceNotifications client={client}/></div>
  <nav className="nutrition-workspace-cards" aria-label="Herramientas de nutrición">{cards.map(card=><button key={card.id} type="button" className={section===card.id?'nutrition-workspace-card active':'nutrition-workspace-card'} aria-pressed={section===card.id} onClick={()=>setSection(card.id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={card.path}/></svg><span><strong>{card.title}</strong><small>{card.text}</small></span><span aria-hidden="true">›</span></button>)}</nav>
  <div hidden={section!=='guides'}><NutritionMaterials client={client}/><button className="card nutrition-plans-shortcut" type="button" onClick={()=>setSection('personal')}>▸ Planes personalizados <span aria-hidden="true">›</span></button><details className="card nutrition-library"><summary>Consultar guías y recetarios</summary><AdminFoodGuide/><AdminRecipeLibrary/></details></div>
  <div hidden={section!=='personal'}><PersonalNutrition client={client} onDirtyChange={onDirtyChange}/></div>
  {section==='tracking'&&<NutritionTracking client={client}/>}
 <p className="nutrition-workspace-signature">GYM NATURE SOUL</p></section>
}
