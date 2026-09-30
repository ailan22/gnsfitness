import test from 'node:test'
import assert from 'node:assert/strict'
import { securityHeaders } from '../scripts/security-headers.mjs'
test('publication constrains scripts and backend destinations and disables browser caching',()=>{
 const headers=securityHeaders('https://example.supabase.co')
 assert.match(headers,/script-src 'self';/)
 assert.doesNotMatch(headers,/unsafe-eval|script-src[^;]*unsafe-inline/)
 assert.match(headers,/connect-src 'self' https:\/\/example.supabase.co wss:\/\/example.supabase.co;/)
 assert.match(headers,/frame-ancestors 'none'/)
 assert.match(headers,/Cache-Control: no-store/)
 for(const url of ['https://evil.test','https://example.supabase.co.evil.test',"https://example.supabase.co/; script-src *",undefined])assert.throws(()=>securityHeaders(url))
})
