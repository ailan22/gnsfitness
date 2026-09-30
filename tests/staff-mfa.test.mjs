import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const compiled = ts.transpileModule(fs.readFileSync(new URL('../src/StaffMfa.tsx',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2023},
}).outputText
function harness({level='aal1',failure=false,existing=true,badCode=false}={}) {
 const states=[],effects=[],calls=[];let cursor=0,tree,callback;const exports={}
 const mfa={
  async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:level},error:failure?{}:null}},
  async listFactors(){return {data:{totp:existing?[{id:'factor',status:'verified'}]:[],all:[]},error:failure?{}:null}},
  async enroll(){calls.push('enroll');return {data:{id:'factor',totp:{qr_code:'data:image/svg+xml,private',secret:'PRIVATE-TEST-SECRET'}},error:null}},
  async challenge(){calls.push('challenge');return {data:{id:'challenge'},error:null}},
  async verify(){calls.push('verify');return {data:{},error:badCode?{}:null}},
 }
 vm.runInNewContext(compiled,{exports,setTimeout,clearTimeout,require(name){
  if(name==='react')return {useState(initial){const n=cursor++;if(!(n in states))states[n]=initial;return [states[n],v=>{states[n]=typeof v==='function'?v(states[n]):v}]},useEffect(effect){if(!effects.length)effects.push(effect)}}
  if(name==='react/jsx-runtime')return {Fragment:'fragment',jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}
  throw Error(name)
 }})
 const props={client:{auth:{mfa,onAuthStateChange(fn){callback=fn;return {data:{subscription:{unsubscribe(){}}}}}}},children:'PRIVATE-ADMIN-PANEL',onVerified:v=>calls.push(['ready',v])}
 function render(){cursor=0;tree=exports.default(props)}
 function nodes(n=tree){return !n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children ?? null)]}
 render()
 return {calls,text:()=>JSON.stringify(tree),async start(){effects[0]();await new Promise(r=>setTimeout(r,0));render()},
  async enroll(){await nodes().find(n=>n.type==='button'&&n.props.children==='Configurar doble factor').props.onClick();await new Promise(r=>setTimeout(r,0));render()},
  async verify(){nodes().find(n=>n.type==='input').props.onChange({target:{value:'123456'}});render();await nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});render()},
  signOut(){callback('SIGNED_OUT');render()},
 }
}
test('staff panel stays hidden until assurance is verified, not just password login',async()=>{
 const ui=harness();assert.doesNotMatch(ui.text(),/PRIVATE-ADMIN-PANEL/);await ui.start();assert.doesNotMatch(ui.text(),/PRIVATE-ADMIN-PANEL/)
 assert.ok(ui.calls.some(v=>Array.isArray(v)&&v[1]===false))
})
test('assurance failure denies access even when aal2 was returned alongside error',async()=>{
 const ui=harness({level:'aal2',failure:true});await ui.start();assert.doesNotMatch(ui.text(),/PRIVATE-ADMIN-PANEL/);assert.match(ui.text(),/No se pudo comprobar/)
})
test('verified MFA unlocks panel, sign-out immediately hides it',async()=>{
 const ui=harness({level:'aal2'});await ui.start();assert.match(ui.text(),/PRIVATE-ADMIN-PANEL/);ui.signOut();assert.doesNotMatch(ui.text(),/PRIVATE-ADMIN-PANEL/)
})
test('MFA enrollment is explicit and no secret is generated during mount',async()=>{
 const ui=harness({existing:false});await ui.start();assert.ok(!ui.calls.includes('enroll'));await ui.enroll();assert.ok(ui.calls.includes('enroll'));assert.match(ui.text(),/PRIVATE-TEST-SECRET/)
})
test('invalid one-time code never unlocks data and clears the entered code',async()=>{
 const ui=harness({badCode:true});await ui.start();await ui.verify();assert.doesNotMatch(ui.text(),/PRIVATE-ADMIN-PANEL|123456/);assert.match(ui.text(),/No se pudo validar/)
})
