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
 return {fill:(index,text)=>nodes(tree).filter(n=>n.type==='textarea')[index].props.onChange({target:{value:text}}),values:()=>nodes(tree).filter(n=>n.type==='textarea').map(n=>n.props.value),body:()=>value}
}
test('meal editor keeps the first meal in its own box and preserves legacy instructions through edits',()=>{
 const e=editor();e.fill(1,'Yogur 200 g');e.fill(2,'Arroz y pollo');e.fill(1,'Yogur 250 g');assert.equal(e.values()[0],'');assert.equal(e.values()[1],'Yogur 250 g');assert.equal(e.values()[2],'Arroz y pollo')
 const restored=editor(e.body());assert.deepEqual(restored.values(),e.values());restored.fill(1,'');assert.equal(restored.values()[2],'Arroz y pollo')
 const legacy=editor('Plan anterior\nIndicaciones importantes');legacy.fill(4,'Cena nueva');assert.equal(legacy.values()[0],'Plan anterior\nIndicaciones importantes');assert.equal(editor(legacy.body()).values()[4],'Cena nueva')
})
