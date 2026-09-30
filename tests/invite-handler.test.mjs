import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source=ts.transpileModule(fs.readFileSync(new URL('../supabase/functions/invite-student/index.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText
function harness({role='admin',valid=true,existing=false,prepareFail=false,sendFail=false,linkFail=false}={}){
 const calls=[];const exports={}
 const client={auth:{async getUser(){return {data:{user:valid?{id:'admin'}:null},error:null}}},from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:{role},error:null}}}},async rpc(name,args){calls.push({name,args});return name==='prepare_student_access'?{data:{email:'verified@example.test',user_id:existing?'existing':null},error:prepareFail?{code:'P0001',message:'Esperá un minuto'}:null}:{error:linkFail?{}:null}}}
 const admin={auth:{admin:{async inviteUserByEmail(email,opts){calls.push({name:'invite',email,opts});return {data:{user:{id:'new'}},error:sendFail?{}:null}}},async resetPasswordForEmail(email,opts){calls.push({name:'recover',email,opts});return {error:sendFail?{}:null}}}}
 const env={APP_URL:'https://app.example.test',SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'}
 vm.runInNewContext(source,{exports,URL,Response,Request,TextDecoder,Deno:{env:{get:k=>env[k]},serve(){}},require(){return {createClient:(_u,key)=>key==='service'?admin:client}}})
 return {calls,async run(origin='https://app.example.test',body=JSON.stringify({member_id:'00000000-0000-4000-8000-000000000010',email:'attacker@example.test',redirectTo:'https://attacker.test'})){return exports.handleInvite(new Request('https://project.supabase.co/functions/v1/invite-student',{method:'POST',headers:{origin,authorization:'Bearer token'},body}))}}
}

test('malformed JSON, null and oversized byte payloads are rejected before any side effect',async()=>{
 for(const [body,status] of [['{',400],['null',400],['[]',400],['x'.repeat(1025),413],['é'.repeat(600),413]]) {
  const h=harness();assert.equal((await h.run(undefined,body)).status,status);assert.equal(h.calls.length,0)
 }
})
test('invalid session and non-admin cannot send mail',async()=>{for(const config of [{valid:false},{role:'student'}]){const h=harness(config);assert.ok((await h.run()).status>=400);assert.equal(h.calls.length,0)}})
test('foreign origin cannot invoke invitation',async()=>{const h=harness();assert.equal((await h.run('https://other.test')).status,403);assert.equal(h.calls.length,0)})
test('native origins retain online administrator checks and public email callbacks',async()=>{
 for(const origin of ['https://localhost','capacitor://localhost']) {
  const h=harness();const r=await h.run(origin)
  assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin)
  assert.equal(h.calls.find(c=>c.name==='invite').opts.redirectTo,'https://app.example.test/reset-password')
  const denied=harness({role:'student'});assert.equal((await denied.run(origin)).status,403);assert.equal(denied.calls.length,0)
 }
 for(const origin of ['https://localhost.evil.test','http://localhost','null']) assert.equal((await harness().run(origin)).status,403)
})
test('new invitation uses verified email and configured redirect only',async()=>{const h=harness();assert.equal((await h.run()).status,200);const send=h.calls.find(c=>c.name==='invite');assert.equal(send.email,'verified@example.test');assert.equal(send.opts.redirectTo,'https://app.example.test/reset-password');assert.equal(h.calls.at(-1).name,'finish_student_access')})
test('existing account is linked before recovery mail without creating a duplicate user',async()=>{const h=harness({existing:true});assert.equal((await h.run()).status,200);assert.equal(h.calls[1].name,'finish_student_access');assert.equal(h.calls[2].name,'recover')})
test('failed preparation, delivery or linking never claims success',async()=>{for(const config of [{prepareFail:true},{sendFail:true},{linkFail:true},{existing:true,sendFail:true}]){const h=harness(config);const r=await h.run();assert.ok(r.status>=400);assert.equal((await r.json()).ok,undefined)}})
