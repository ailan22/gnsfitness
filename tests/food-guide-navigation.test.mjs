import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const guide=JSON.parse(readFileSync(new URL('../src/admin-alimentacion.json',import.meta.url),'utf8'))
const source=ts.transpileModule(readFileSync(new URL('../src/StudentFoodGuide.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
function harness(){
 const states=[],refs=[],host={id:'persistent-toolbar'},exports={};let cursor=0,rc=0,tree
 vm.runInNewContext(source,{exports,requestAnimationFrame:fn=>fn(),require(name){
  if(name==='react')return {useState(v){const i=cursor++;if(!(i in states))states[i]=v;return [states[i],v=>states[i]=v]},useRef(v){return refs[rc++]??=( {current:v})},useCallback:fn=>fn,useLayoutEffect:()=>{}}
  if(name==='./studentGuideScroll')return {showGuideStart:()=>{}}
  if(name==='react-dom')return {createPortal:(child,target)=>({type:'portal',props:{children:child,target}})}
  if(name==='react/jsx-runtime')return {Fragment:'fragment',jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}
  if(name==='./admin-alimentacion.json')return {__esModule:true,default:guide}
  throw Error(name)
 }})
 function render(){cursor=0;rc=0;tree=exports.default()}
 function nodes(n=tree){if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(child=>nodes(child??null));return [n,...nodes(n.props?.children ?? null)]}
 function click(text){const n=nodes().find(n=>n.type==='button'&&JSON.stringify(n.props.children).includes(text));assert.ok(n,text);n.props.onClick();render()}
 function back(){const p=nodes().find(n=>n.type==='portal');assert.ok(p,'back button must escape protected content');assert.equal(p.props.target,host);p.props.children.props.onClick();render()}
 render();tree.props.ref({closest:()=>({querySelector:()=>host}),scrollIntoView(){}});render()
 return {click,back,nodes}
}
test('food article returns to its category, then guide menu using persistent toolbar',()=>{
 const h=harness();h.click('Cómo armar el plato');h.click(guide.sections.find(s=>s.id==='plato').items[0].title);assert.ok(h.nodes().some(n=>n.type==='article'));h.back();assert.ok(!h.nodes().some(n=>n.type==='article'));h.back();assert.ok(h.nodes().some(n=>n.type==='nav'));assert.ok(!h.nodes().some(n=>n.type==='portal'))
})
test('pre-training timing returns to timing choices then guide menu',()=>{
 const h=harness();h.click('Antes de entrenar');h.click('3 horas antes');h.back();assert.ok(h.nodes().some(n=>n.type==='button'&&JSON.stringify(n.props.children).includes('30–45 minutos')));h.back();assert.ok(h.nodes().some(n=>n.type==='nav'))
})



