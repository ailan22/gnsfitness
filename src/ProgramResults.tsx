import MemberSectionTitle from './MemberSectionTitle'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'

type Result = { routine_id: string; program_name: string; evaluated_on: string; observations: string; comparison: string; next_steps: string; revision: number }
const columns = 'routine_id,program_name,evaluated_on,observations,comparison,next_steps,revision'
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,10)
const empty = (): Result => ({ routine_id:'', program_name:'', evaluated_on:today(), observations:'', comparison:'', next_steps:'', revision:0 })

export default function ProgramResults({client,memberId,admin=false,onDirtyChange}:{client:SupabaseClient;memberId:string;admin?:boolean;onDirtyChange?:(dirty:boolean)=>void}) {
  const [rows,setRows]=useState<Result[]>([]), [routines,setRoutines]=useState<{id:string;name:string;program_rounds:number}[]>([])
  const [form,setForm]=useState(empty), [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [dirty,setDirty]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState(''), [refresh,setRefresh]=useState(0)
  useEffect(()=>{onDirtyChange?.(dirty);const warn=(e:BeforeUnloadEvent)=>{if(dirty||busy)e.preventDefault()};window.addEventListener('beforeunload',warn);return()=>{window.removeEventListener('beforeunload',warn);onDirtyChange?.(false)}},[dirty,busy,onDirtyChange])
  useEffect(()=>{let active=true;void (async()=>{setLoading(true);setError('');try{
    const r=await readAllPages((a,b)=>client.from('program_results').select(columns,{count:'exact'}).eq('member_id',memberId).order('evaluated_on',{ascending:false}).order('routine_id').range(a,b));if(r.error)throw r.error
    const plans=admin?await readAllPages((a,b)=>client.from('routines').select('id,name,program_rounds',{count:'exact'}).eq('member_id',memberId).order('created_at',{ascending:false}).order('id').range(a,b)):null
    if(plans?.error)throw plans.error
    if(active){setRows(r.data as Result[]);setRoutines(plans?.data??[])}
  }catch{if(active)setError('No se pudieron cargar las evaluaciones. Reintentá antes de guardar.')}finally{if(active)setLoading(false)}})();return()=>{active=false}},[client,memberId,admin,refresh])
  function choose(id:string){if(dirty&&!window.confirm('¿Descartar la evaluación sin guardar?'))return;setForm(rows.find(r=>r.routine_id===id)??{...empty(),routine_id:id,program_name:routines.find(r=>r.id===id)?.name??''});setDirty(false);setMessage('')}
  async function save(){if(busy||loading||error||!form.routine_id)return;setBusy(true);setMessage('');try{
    const r=await client.rpc('save_program_result',{p_member:memberId,p_routine:form.routine_id,p_date:form.evaluated_on,p_observations:form.observations,p_comparison:form.comparison,p_next_steps:form.next_steps,p_expected:form.revision});if(r.error)throw r.error
    const saved={...form,revision:r.data as number};setForm(saved);setRows(old=>[saved,...old.filter(x=>x.routine_id!==saved.routine_id)]);setDirty(false);setMessage('Evaluación guardada y publicada en el panel del alumno.')
  }catch{setMessage('No se pudo confirmar el guardado. Tu texto sigue acá. Si otra ventana modificó la evaluación, copiá tus cambios y recargá antes de reintentar.')}finally{setBusy(false)}}
  const content=<><p className="muted">{admin?'Registrá los cambios observados al cerrar cada programa. Indicá las pruebas o referencias usadas y evitá atribuir mejoras que no hayas evaluado.':'Acá encontrarás la evaluación de tu entrenador al finalizar cada programa.'}</p>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
    <button type="button" className="text-button" disabled={busy||loading} onClick={()=>{if(dirty&&!window.confirm('¿Descartar los cambios y recargar las evaluaciones?'))return;setDirty(false);setForm(empty());setRefresh(n=>n+1)}}>Actualizar evaluaciones</button>
    {loading?<p role="status">Cargando…</p>:!error&&<>{admin&&<form onSubmit={e=>{e.preventDefault();void save()}}><fieldset disabled={busy} className="plain-fieldset">
      <label>Programa evaluado<select required value={form.routine_id} onChange={e=>choose(e.target.value)}><option value="">Seleccioná un programa</option>{routines.map(r=><option key={r.id} value={r.id}>{r.name} · {r.program_rounds} semanas · {r.id.slice(0,6)}</option>)}</select></label>
      {form.routine_id&&<><label>Fecha de evaluación<input type="date" required max={today()} value={form.evaluated_on} onChange={e=>{setForm({...form,evaluated_on:e.target.value});setDirty(true)}}/></label>
        {([['observations','Cambios y beneficios observados'],['comparison','Comparación inicial y final · pruebas, valores o percepción del alumno'],['next_steps','Próximos pasos']] as const).map(([key,label])=><label key={key}>{label}<textarea required={key==='observations'} maxLength={4000} rows={4} value={form[key]} onChange={e=>{setForm({...form,[key]:e.target.value});setDirty(true)}}/></label>)}
        <p className="muted">El alumno verá los tres campos. Guardar actualizará la evaluación de este programa.</p><button disabled={!dirty||!form.observations.trim()}>{busy?'Guardando…':'Guardar y publicar evaluación'}</button></>}
    </fieldset></form>}
    {rows.length===0?<p>Todavía no hay evaluaciones publicadas.</p>:rows.map(r=><details className="card program-result" key={r.routine_id}><summary>{r.program_name} <small>Evaluación · {r.evaluated_on.split('-').reverse().join('/')}</small></summary><h3>Cambios observados</h3><p>{r.observations}</p>{r.comparison&&<><h3>Punto de partida y resultado</h3><p>{r.comparison}</p></>}{r.next_steps&&<><h3>Próximos pasos</h3><p>{r.next_steps}</p></>}</details>)}</>}
  </>
  return admin?<details className="card"><summary><MemberSectionTitle kind="results">Resultados del programa</MemberSectionTitle></summary>{content}</details>:<section className="student-content" aria-label="Resultados del programa"><header className="card"><p className="eyebrow">TU EVOLUCIÓN</p><h2>Resultados del programa</h2></header>{content}</section>
}
