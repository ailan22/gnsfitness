const meals = ['Desayuno','Almuerzo','Merienda','Cena','Antes de entrenar','Después de entrenar','Hidratación e indicaciones']
const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const mealKey=(week:number,day:string,meal:string)=>`Semana ${week} · ${day} · ${meal}`
function splitMeals(value:string) {
 const parts=value.split(/(?:^|\n\n)\[([^\]\n]+)\]\n/)
 const sections:Record<string,string>={}
 let notes=parts[0],weeks=1
 for(let i=1;i<parts.length;i+=2){
  const key=parts[i],text=parts[i+1]??'',match=/^Semana ([1-9]\d?)(?: · (.+) · (.+))?$/.exec(key)
  if(meals.includes(key)){sections[key]=text}
  else if(match&&Number(match[1])<=52&&(!match[2]||(days.includes(match[2])&&meals.includes(match[3])))){
   weeks=Math.max(weeks,Number(match[1]));sections[key]=text
  }else notes+=`\n\n[${key}]\n${text}`
 }
 return {notes,sections,weeks}
}
function serialize(notes:string,sections:Record<string,string>,weeks:number){
 return [notes,...meals.filter(m=>sections[m]?.trim()).map(m=>`[${m}]\n${sections[m]}`),...Array.from({length:weeks},(_,i)=>i+1).flatMap(w=>[`[Semana ${w}]\n`,...days.flatMap(d=>meals.map(m=>mealKey(w,d,m))).filter(k=>sections[k]?.trim()).map(k=>`[${k}]\n${sections[k]}`)])].filter(Boolean).join('\n\n')
}
export function MealPlanView({value}:{value:string}){
 const {notes,sections,weeks}=splitMeals(value)
 return <div className="meal-plan-view">{notes.trim()&&<p className="nutrition-plan-text">{notes}</p>}{meals.filter(m=>sections[m]?.trim()).map(m=><section key={m}><h4>{m}</h4><p className="nutrition-plan-text">{sections[m]}</p></section>)}{Array.from({length:weeks},(_,i)=>i+1).filter(w=>days.some(d=>meals.some(m=>sections[mealKey(w,d,m)]?.trim()))).map(w=><details className="card" key={w}><summary>Semana {w}</summary>{days.filter(d=>meals.some(m=>sections[mealKey(w,d,m)]?.trim())).map(d=><details className="card" key={d}><summary>{d}</summary>{meals.filter(m=>sections[mealKey(w,d,m)]?.trim()).map(m=><section key={m}><h4>{m}</h4><p className="nutrition-plan-text">{sections[mealKey(w,d,m)]}</p></section>)}</details>)}</details>)}</div>
}
export default function MealPlanEditor({value,onChange}:{value:string;onChange:(value:string)=>void}) {
 const {notes,sections,weeks}=splitMeals(value)
 const update=(key:string,text:string)=>onChange(serialize(key==='notes'?text:notes,key==='notes'?sections:{...sections,[key]:text},weeks))
 const field=(key:string,label:string)=><fieldset className="card" key={key}><legend>{label}</legend><label>Alimentos, cantidades y alternativas<textarea aria-label={key} rows={4} maxLength={2500} value={sections[key]??''} onChange={e=>update(key,e.target.value)} placeholder={'Alimento y cantidad\nPreparación u horario\nAlternativa equivalente'}/></label></fieldset>
 const legacy=meals.some(m=>sections[m]?.trim())
 return <section className="meal-plan-editor"><p>Organizá el plan por semanas. Abrí la flecha de cada día para completar sus comidas.</p><label>Objetivo, revisión y notas generales<textarea rows={4} maxLength={6000} value={notes} onChange={e=>update('notes',e.target.value)}/></label>{legacy&&<details className="card"><summary>Indicaciones por comida del plan anterior</summary><p>Se conservan hasta que decidas modificarlas.</p><div className="meal-plan-grid">{meals.map(m=>field(m,m))}</div></details>}{Array.from({length:weeks},(_,i)=>i+1).map(w=><details className="card meal-week" key={w}><summary><strong>Semana {w}</strong> · 7 días</summary>{days.map(d=><details className="card meal-day" key={d}><summary>{d}</summary><div className="meal-plan-grid">{meals.map(m=>field(mealKey(w,d,m),m))}</div></details>)}</details>)}<button type="button" className="secondary" disabled={weeks>=52} onClick={()=>onChange(serialize(notes,sections,weeks+1))}>Añadir otra semana</button><p className={value.length>20000?'error':'muted'} role={value.length>20000?'alert':undefined}>{value.length.toLocaleString('es-UY')} / 20.000 caracteres. {value.length>20000?'Resumí el contenido antes de guardar.':'El borrador conserva todas las semanas al guardar.'}</p><p className="muted">Las cantidades se indican manualmente. Los objetivos calculados no comprueban automáticamente los nutrientes de los alimentos.</p></section>
}
