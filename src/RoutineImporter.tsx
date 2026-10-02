import { useState } from 'react'
import { detectRoutineDimensions, parseRoutine, routineExample } from './routineImport'
import type { CloudPlan } from './cloudTraining'
export default function RoutineImporter({weeks,days,blockWeeks,onApply}:{weeks:number;days:number;blockWeeks:number;onApply:(plan:CloudPlan,dimensions:{weeks:number;days:number;blockWeeks:number})=>void}){
 const [text,setText]=useState(''),[preview,setPreview]=useState<ReturnType<typeof parseRoutine>|null>(null)
 const [signature,setSignature]=useState(''),[message,setMessage]=useState('')
 const detected=detectRoutineDimensions(text)
 const dimensions={weeks:detected.weeks||weeks,days:detected.days||days,blockWeeks:Math.min(blockWeeks,detected.weeks||weeks)}
 const current=`${weeks}/${days}/${blockWeeks}/${text}`
 return <details className="routine-import"><summary>Pegar rutina o macrociclo planificado</summary>
  <p>Pegá tu planificación: las semanas y los días se detectan en el texto. Se conservan los ejercicios, las series, las repeticiones, el RIR y los descansos. Revisá la distribución antes de asignarla.</p>
  <details><summary>Ver formato de ejemplo</summary><pre>{routineExample}</pre><p>Podés indicar rangos como «Semanas 1-24». Las semanas y días que no incluyas quedan vacíos; no se inventan progresiones.</p></details>
  <label>Planificación para distribuir<textarea rows={9} maxLength={200000} value={text} onChange={e=>{setText(e.target.value);setMessage('')}} placeholder="Semana 1&#10;Día 1&#10;Sentadilla 3x10"/></label>
  <button type="button" className="secondary" disabled={!text.trim()} onClick={()=>{setPreview(parseRoutine(text,dimensions.weeks,dimensions.days,dimensions.blockWeeks));setSignature(current);setMessage('')}}>Distribuir rutina</button>
  {preview&&signature===current&&<><p>{dimensions.weeks} semanas · {dimensions.days} días por semana · {preview.sessions.length} sesiones reconocidas de {dimensions.weeks*dimensions.days} posibles.</p>
   {preview.errors.length>0?<div role="alert" className="error"><strong>Corregí estas líneas antes de aplicar:</strong><ul>{preview.errors.slice(0,30).map((error,i)=><li key={i}>{error}</li>)}</ul></div>:<>
    <details><summary>Vista previa por semana y día</summary><div className="import-preview">{preview.sessions.map(s=><article key={`${s.week}/${s.day}`}><strong>Semana {s.week} · Día {s.day}</strong>{s.exercises.map(e=><p key={e.id}>{e.name} · {e.sets} × {e.reps}{e.rir?` · RIR ${e.rir}`:''}{e.load?` · Carga ${e.load}`:''}{e.rest?` · Descanso ${e.rest}`:''}{e.tempo?` · Tempo ${e.tempo}`:''}{e.notes?` · ${e.notes}`:''}</p>)}{s.guidance&&<p>{s.guidance}</p>}{s.tests.map(t=><p key={t.id}><strong>Prueba:</strong> {t.details}</p>)}</article>)}</div></details>
    <button type="button" onClick={()=>{if(!window.confirm('¿Reemplazar la planificación del formulario por esta distribución? Todavía tendrás que guardar la rutina para asignarla al socio.'))return;onApply(preview.plan,dimensions);setPreview(null);setMessage('Planificación incorporada al formulario. Revisala y guardá la rutina para asignarla.')}}>Aplicar al formulario</button>
   </>}
  </>}{preview&&signature!==current&&<p>El texto o la duración cambiaron. Volvé a revisar la distribución.</p>}{message&&<p role="status">{message}</p>}
 </details>
}
