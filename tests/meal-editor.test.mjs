import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const exports={}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/MealPlanEditor.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:()=>({jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})})})
function editor(initial=''){
 let value=initial,tree
 const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)]
 const render=()=>{tree=exports.default({value,onChange:v=>{value=v;render()}})};render()
 return {fill:(index,text)=>nodes(tree).filter(n=>n.type==='textarea')[index].props.onChange({target:{value:text}}),fillNamed:(key,text)=>nodes(tree).find(n=>n.type==='textarea'&&n.props['aria-label']===key).props.onChange({target:{value:text}}),addWeek:()=>nodes(tree).find(n=>n.type==='button').props.onClick(),values:()=>nodes(tree).filter(n=>n.type==='textarea').map(n=>n.props.value),body:()=>value}
}
test('meal editor keeps the first meal in its own box and preserves legacy instructions through edits',()=>{
 const e=editor();e.fill(1,'Yogur 200 g');e.fill(2,'Arroz y pollo');e.fill(1,'Yogur 250 g');assert.equal(e.values()[0],'');assert.equal(e.values()[1],'Yogur 250 g');assert.equal(e.values()[2],'Arroz y pollo')
 const restored=editor(e.body());assert.deepEqual(restored.values(),e.values());restored.fill(1,'');assert.equal(restored.values()[2],'Arroz y pollo')
 const legacy=editor('Plan anterior\nIndicaciones importantes');legacy.fill(4,'Cena nueva');assert.equal(legacy.values()[0],'Plan anterior\nIndicaciones importantes');assert.equal(editor(legacy.body()).values()[4],'Cena nueva')
 const around=editor('[Antes y después de entrenar]\nIndicaciones anteriores');around.fill(5,'Antes: fruta');around.fill(6,'Después: comida habitual');const reload=editor(around.body());assert.ok(reload.values()[0].includes('Indicaciones anteriores'));assert.equal(reload.values()[5],'Antes: fruta');assert.equal(reload.values()[6],'Después: comida habitual')
})
test('weekly plan isolates all seven days, preserves added weeks and legacy meals after reload',()=>{
 const e=editor('[Desayuno]\nDesayuno anterior')
 for(const d of ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'])e.fillNamed(`Semana 1 · ${d} · Desayuno`,`Comida de ${d}`)
 e.addWeek();e.fillNamed('Semana 2 · Lunes · Cena','Cena segunda semana')
 const restored=editor(e.body());assert.equal(restored.body(),e.body());assert.equal(restored.values()[1],'Desayuno anterior')
 restored.fillNamed('Semana 1 · Lunes · Desayuno','Cambio solo lunes')
 assert.ok(restored.body().includes('Comida de Domingo'));assert.ok(restored.body().includes('Cena segunda semana'));assert.ok(!restored.body().includes('Comida de Lunes'))
 restored.addWeek();const third=editor(restored.body());third.fillNamed('Semana 3 · Domingo · Después de entrenar','Recuperación');assert.ok(third.body().includes('Recuperación'))
})
