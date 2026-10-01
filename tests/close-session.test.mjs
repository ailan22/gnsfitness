import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const api = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/closeSession.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{exports:api,setTimeout,clearTimeout})
function disk() {
 const data=new Map([['session','token'],['session.biometric.v1','cipher'],['other-app','keep']])
 return {data,removeItem:key=>data.delete(key)}
}
test('logout clears local access even when server and biometric vault fail',async()=>{
 const store=disk();let revoked=false
 const result=await api.closeSession({disk:store,sessionKey:'session',revoke:async()=>{revoked=true;return {error:Error('offline')}},disableBiometrics:async()=>{throw Error('vault unavailable')}})
 assert.equal(revoked,true);assert.equal(result.remoteRevoked,false)
 assert.deepEqual([...store.data],[['other-app','keep']])
})
test('logout bounds network wait and clears a concurrent persisted refresh',async()=>{
 const store=disk()
 const result=await api.closeSession({disk:store,sessionKey:'session',timeoutMs:10,revoke:()=>new Promise(()=>{store.data.set('session-user','refresh')})})
 assert.equal(result.remoteRevoked,false);assert.deepEqual([...store.data],[['other-app','keep']])
})
test('successful revocation still has access to session and clears only this app',async()=>{
 const store=disk()
 const result=await api.closeSession({disk:store,sessionKey:'session',revoke:async()=>{assert.equal(store.data.get('session'),'token');return {error:null}}})
 assert.equal(result.remoteRevoked,true);assert.deepEqual([...store.data],[['other-app','keep']])
})
