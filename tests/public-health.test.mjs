import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectPublicSite} from '../scripts/check-public-health.mjs'
const headers={'content-type':'text/html','content-security-policy':"script-src 'self'; frame-ancestors 'none'",'strict-transport-security':'max-age=31536000','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
const html='<div id="root"></div><script src="/assets/index-test.js"></script>'
test('remote monitor checks actual bundle and restrictive headers',async()=>{
 let requests=0
 const report=await inspectPublicSite(async()=>++requests===1?new Response(html,{headers}):new Response('ok',{headers:{'content-type':'application/javascript'}}))
 assert.equal(report.status,'passed');assert.equal(requests,2)
})
test('a success-looking HTML page does not conceal a missing JS bundle',async()=>{
 let requests=0
 const report=await inspectPublicSite(async()=>++requests===1?new Response(html,{headers}):new Response('Not found',{status:404}))
 assert.equal(report.status,'failed');assert.equal(report.checks.find(c=>c.name==='bundle_available').passed,false)
})
test('network failure is never reported as healthy and error contents are not logged',async()=>{
 const report=await inspectPublicSite(async()=>{throw Error('DO_NOT_LOG')})
 assert.equal(report.status,'failed');assert.ok(!JSON.stringify(report).includes('DO_NOT_LOG'))
})
test('weak HSTS and injected executable origins are rejected',async()=>{
 let requests=0
 const report=await inspectPublicSite(async()=>++requests===1?new Response(html,{headers:{...headers,'strict-transport-security':'max-age=60','content-security-policy':"script-src 'self' https://other.invalid; frame-ancestors 'none'"}}):new Response('ok',{headers:{'content-type':'text/javascript'}}))
 assert.equal(report.checks.find(c=>c.name==='restricted_scripts').passed,false)
 assert.equal(report.checks.find(c=>c.name==='hsts').passed,false)
})
