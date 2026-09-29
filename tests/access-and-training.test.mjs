import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(file) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText,
    { exports, setTimeout, clearTimeout })
  return exports
}
const { observeAccount } = load('observeAccount.ts')
const { trainingProgress } = load('cloudTraining.ts')
const tick = () => new Promise(resolve => setTimeout(resolve, 10))
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

function authHarness({ delayedRole, invalid = false, recovery = false } = {}) {
  let listener
  let id
  let authCalls = 0
  let roleCalls = 0
  let unsubscribed = false
  const events = []
  const client = {
    auth: {
      onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() { unsubscribed = true } } } } },
      async getUser() { authCalls++; return { data: { user: invalid ? null : { id } }, error: invalid ? {} : null } },
    },
    from(table) {
      assert.equal(table, 'user_roles')
      return { select() { return this }, eq(_column, userId) { this.id = userId; return this }, maybeSingle() {
        roleCalls++
        return delayedRole ? delayedRole.promise : Promise.resolve({ data: { role: this.id === 'admin' ? 'admin' : 'student' }, error: null })
      } }
    },
  }
  const callbacks = Object.fromEntries(['loading', 'signedOut', 'account', 'recovery', 'error'].map(name => [name, (...args) => events.push({ name, args })]))
  const stop = observeAccount(client, callbacks, recovery)
  return {
    emit(event, userId) { id = userId; listener(event, userId ? { user: { id: userId } } : null) },
    stop, events,
    counts() { return { authCalls, roleCalls, unsubscribed } },
  }
}

test('initial and repeated sign-in events load the role only once', async () => {
  const h = authHarness()
  h.emit('INITIAL_SESSION', 'admin'); h.emit('SIGNED_IN', 'admin')
  await tick()
  h.emit('SIGNED_IN', 'admin'); await tick()
  assert.equal(h.counts().authCalls, 1)
  assert.equal(h.counts().roleCalls, 1)
  assert.equal(h.events.filter(event => event.name === 'loading').length, 1)
  assert.equal(h.events.filter(event => event.name === 'account').length, 1)
  h.stop()
})

test('token refresh rechecks identity and role without clearing the mounted panel', async () => {
  const h = authHarness()
  h.emit('INITIAL_SESSION', 'admin'); await tick()
  h.emit('TOKEN_REFRESHED', 'admin'); await tick()
  assert.equal(h.counts().authCalls, 2)
  assert.equal(h.counts().roleCalls, 2)
  assert.equal(h.events.filter(event => event.name === 'loading').length, 1)
  h.stop()
})

test('sign-out prevents a late role response from restoring access', async () => {
  const wait = deferred()
  const h = authHarness({ delayedRole: wait })
  h.emit('SIGNED_IN', 'admin'); await tick()
  h.emit('SIGNED_OUT', null)
  wait.resolve({ data: { role: 'admin' }, error: null }); await tick()
  assert.equal(h.events.filter(event => event.name === 'account').length, 0)
  assert.equal(h.events.at(-1).name, 'signedOut')
  h.stop()
})

test('switching accounts loads the new role instead of reusing the administrator', async () => {
  const h = authHarness()
  h.emit('SIGNED_IN', 'admin'); await tick()
  h.emit('SIGNED_IN', 'student'); await tick()
  const result = h.events.filter(event => event.name === 'account').at(-1)
  assert.equal(result.args[0].id, 'student')
  assert.equal(result.args[1], 'student')
  assert.equal(h.events.filter(event => event.name === 'loading').length, 2)
  h.stop()
})

test('recovery verifies the user without consulting or displaying an administrator role', async () => {
  const h = authHarness()
  h.emit('PASSWORD_RECOVERY', 'admin'); await tick()
  assert.equal(h.counts().authCalls, 1)
  assert.equal(h.counts().roleCalls, 0)
  assert.equal(h.events.find(event => event.name === 'account').args[1], null)
  assert.equal(h.events[0].name, 'recovery')
  h.stop()
})

test('unmount cancels scheduled work, including the development StrictMode pass', async () => {
  const h = authHarness()
  h.emit('INITIAL_SESSION', 'admin'); h.stop(); await tick()
  assert.equal(h.counts().authCalls, 0)
  assert.equal(h.counts().unsubscribed, true)
})

test('invalid session does not grant a panel even if the role query returns admin', async () => {
  const h = authHarness({ invalid: true })
  h.emit('INITIAL_SESSION', 'admin'); await tick()
  assert.equal(h.events.filter(event => event.name === 'account').length, 0)
  assert.equal(h.events.at(-1).name, 'error')
  h.stop()
})

const routine = { id: 'routine', name: 'Plan', days_per_week: 3, program_rounds: 4, block_rounds: 2, plan: {} }
const date = '2026-09-28'
function sessions(days) { return days.map((day, index) => ({ id: String(index).padStart(3, '0'), routine_id: routine.id,
  routine_name: routine.name, day, performed_at: date, created_at: `2026-09-28T12:${String(index).padStart(2, '0')}:00Z` })) }

test('completing day 1 presents day 2', () => {
  assert.equal(trainingProgress(routine, [routine], sessions([1]), date).nextDay, 2)
})
test('completing the last day advances to day 1 of the next week', () => {
  const p = trainingProgress(routine, [routine], sessions([1, 2, 3]), date)
  assert.equal(p.nextDay, 1); assert.equal(p.week, 2); assert.equal(p.block, 1)
})
test('completing a block advances to the next block', () => {
  const p = trainingProgress(routine, [routine], sessions([1, 2, 3, 1, 2, 3]), date)
  assert.equal(p.nextDay, 1); assert.equal(p.week, 1); assert.equal(p.block, 2)
})
test('completing all weeks finishes the program', () => {
  const p = trainingProgress(routine, [routine], sessions([1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]), date)
  assert.equal(p.finished, true)
})
test('time alone does not advance the training day', () => {
  assert.equal(trainingProgress(routine, [routine], sessions([1]), '2026-10-30').nextDay, 2)
})
