const meals = ['Desayuno','Almuerzo','Merienda','Cena','Antes de entrenar','Después de entrenar','Hidratación e indicaciones']
function splitMeals(value:string) {
 const parts=value.split(/(?:^|\n\n)\[([^\]\n]+)\]\n/)
 const sections:Record<string,string>={}
 let notes=parts[0]
 for(let i=1;i<parts.length;i+=2){if(meals.includes(parts[i]))sections[parts[i]]=parts[i+1]??'';else notes+=`\n\n[${parts[i]}]\n${parts[i+1]??''}`}
 return {notes,sections}
}
export default function MealPlanEditor({value,onChange}:{value:string;onChange:(value:string)=>void}) {
 const {notes,sections}=splitMeals(value)
 const update=(key:string,text:string)=>{const next={...sections,[key]:text};onChange([key==='notes'?text:notes,...meals.filter(name=>next[name]?.trim()).map(name=>`[${name}]\n${next[name]}`)].filter(Boolean).join('\n\n'))}
 return <section className="meal-plan-editor"><p>Organizá cada comida con los alimentos, las cantidades y las alternativas indicadas para esta persona.</p><label>Objetivo, revisión y notas generales<textarea rows={4} maxLength={6000} value={notes} onChange={e=>update('notes',e.target.value)}/></label><div className="meal-plan-grid">{meals.map(name=><fieldset className="card" key={name}><legend>{name}</legend><label>Alimentos, cantidades y alternativas<textarea rows={5} maxLength={2500} value={sections[name]??''} onChange={e=>update(name,e.target.value)} placeholder={'Alimento y cantidad\nPreparación u horario, si corresponde\nAlternativa equivalente'}/></label></fieldset>)}</div><p className="muted">Las cantidades se indican manualmente. Los objetivos calculados no comprueban automáticamente los nutrientes de los alimentos.</p></section>
}
