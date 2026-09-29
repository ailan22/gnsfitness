import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'

const source = fs.readFileSync(new URL('../src/biometricSession.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { BiometricSession } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const sessionKey = 'sb-example-auth-token'
const session = n => JSON.stringify({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, user: { id: 'student' } })
function setup() {
  const values = new Map()
  const disk = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }
  let secret, cancelled = false, reads = 0
  const vault = { save: async v => { secret = v }, read: async () => { reads++; if (cancelled) throw new Error('cancelled'); return secret }, remove: async () => { secret = undefined } }
  const create = () => new BiometricSession(sessionKey, disk, vault)
  return { disk, values, create, cancel: () => { cancelled = true }, reads: () => reads, secret: () => secret }
}

test('legacy plaintext is removed and ordinary native login is memory-only', async () => {
  const f = setup()
  f.disk.setItem(sessionKey, session(0))
  const storage = f.create()
  assert.equal(f.disk.getItem(sessionKey), null)
  await storage.setItem(sessionKey, session(1))
  assert.equal(await storage.getItem(sessionKey), session(1))
  assert.equal(f.values.size, 0)
  assert.equal(await f.create().getItem(sessionKey), null)
})

test('cold start cannot restore until native vault grants access; tokens rotate encrypted', async () => {
  const f = setup(), storage = f.create()
  await storage.setItem(sessionKey, session(1))
  await storage.enable()
  const first = f.disk.getItem(storage.diskKey)
  await storage.setItem(sessionKey, session(2))
  const latest = f.disk.getItem(storage.diskKey)
  assert.notEqual(first, latest)
  assert.equal(latest.includes('refresh-2'), false)
  assert.equal(latest.includes(f.secret()), false)
  assert.equal(f.reads(), 1) // rotation does not trigger prompts
  const restart = f.create()
  assert.equal(await restart.getItem(sessionKey), null)
  assert.equal(restart.enabled, false)
  assert.deepEqual(await restart.unlock(), { access_token: 'access-2', refresh_token: 'refresh-2' })
  assert.equal(f.reads(), 2)
})

test('biometric cancellation never supplies a session and allows retry/password', async () => {
  const f = setup(), storage = f.create()
  await storage.setItem(sessionKey, session(1)); await storage.enable()
  const restart = f.create(); f.cancel()
  await assert.rejects(restart.unlock())
  assert.equal(restart.enabled, false)
  assert.equal(await restart.getItem(sessionKey), null)
  assert.equal(restart.saved, true)
  await restart.disable()
  await restart.setItem(sessionKey, session(2))
  assert.equal(await restart.getItem(sessionKey), session(2))
  assert.equal(restart.saved, false)
})

test('cancelled enrollment leaves no saved key or ciphertext', async () => {
  const f = setup(), storage = f.create()
  await storage.setItem(sessionKey, session(1)); f.cancel()
  await assert.rejects(storage.enable())
  assert.equal(storage.saved, false); assert.equal(storage.enabled, false)
  assert.equal(f.secret(), undefined)
  assert.equal(await storage.getItem(sessionKey), session(1))
})

test('tampered ciphertext is rejected before restoring any session', async () => {
  const f = setup(), storage = f.create()
  await storage.setItem(sessionKey, session(1)); await storage.enable()
  const payload = JSON.parse(f.disk.getItem(storage.diskKey))
  payload.data = (payload.data[0] === 'A' ? 'B' : 'A') + payload.data.slice(1)
  f.disk.setItem(storage.diskKey, JSON.stringify(payload))
  const restart = f.create()
  await assert.rejects(restart.unlock())
  assert.equal(restart.enabled, false)
  assert.equal(await restart.getItem(sessionKey), null)
})

test('sign-out queued during enrollment removes keys and prevents old-account restoration', async () => {
  const f = setup(), storage = f.create()
  await storage.setItem(sessionKey, session(1))
  await Promise.all([storage.enable(), storage.removeItem(sessionKey)])
  assert.equal(storage.saved, false); assert.equal(storage.enabled, false)
  assert.equal(f.secret(), undefined)
  assert.equal(await storage.getItem(sessionKey), null)
  await storage.setItem(sessionKey, session(2))
  assert.equal(storage.saved, false)
})

test('Supabase never restores automatically, validates biometric token online and saves its rotation', async () => {
  const f = setup()
  let requests = 0
  const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', email: 'test@example.invalid' }
  const jwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`
  const makeClient = storage => createClient('https://example.supabase.co', 'public-test-key', {
    auth: { storage, storageKey: sessionKey, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url) => {
      requests++
      if (String(url).includes('/logout')) return new Response('{}', { status: 200 })
      assert.ok(String(url).includes('/token?grant_type='))
      return new Response(JSON.stringify({ access_token: jwt, refresh_token: `rotated-${requests}`, token_type: 'bearer', expires_in: 3600, user }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    } },
  })
  const first = f.create(), auth1 = makeClient(first).auth
  assert.equal((await auth1.getSession()).data.session, null)
  assert.equal((await auth1.signInWithPassword({ email: user.email, password: 'only-in-test' })).error, null)
  await first.enable()
  const second = f.create(), auth2 = makeClient(second).auth
  assert.equal((await auth2.getSession()).data.session, null)
  assert.equal(requests, 1)
  assert.equal(second.saved, true)
  const tokens = await second.unlock()
  const result = await auth2.refreshSession({ refresh_token: tokens.refresh_token })
  assert.equal(result.error, null)
  assert.equal(requests, 2)
  assert.equal((await f.create().unlock()).refresh_token, 'rotated-2')
  await auth2.signOut({ scope: 'local' })
  assert.equal(second.saved, false)
  assert.equal(f.secret(), undefined)
})
