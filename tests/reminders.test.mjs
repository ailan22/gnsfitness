import assert from 'node:assert/strict'
import test from 'node:test'
import { dayInUruguay, selectReminders } from '../cloud/reminders/select-reminders.mjs'

const member = { id: 'member', first_name: 'Ejemplo', status: 'Activo' }
const contact = { member_id: member.id, phone_e164: '+59899000000', whatsapp_opt_in_at: '2026-09-01T12:00:00Z' }
const plan = { id: 'plan', member_id: member.id, starts_at: '2026-09-03', ends_at: '2026-10-03' }
const select = (overrides = {}) => selectReminders({ members: [member], contacts: [contact], memberships: [plan], today: '2026-09-28', ...overrides })

test('monthly, quarterly, six-month and annual plans use their own end date', () => {
  for (const starts_at of ['2026-09-03', '2026-07-03', '2026-04-03', '2025-10-03']) {
    const result = select({ memberships: [{ ...plan, starts_at }] })
    assert.equal(result.length, 1)
    assert.equal(result[0].expires_on, '2026-10-03')
  }
})
test('does not send four or six days before expiration', () => {
  assert.equal(select({ today: '2026-09-27' }).length, 0)
  assert.equal(select({ today: '2026-09-29' }).length, 0)
})
test('existing renewal suppresses the old plan notice', () => {
  assert.equal(select({ memberships: [plan, { ...plan, id: 'renewal', starts_at: '2026-10-04', ends_at: '2027-10-03' }] }).length, 0)
})
test('overlapping longer valid plan prevents an obsolete notice', () => {
  assert.equal(select({ memberships: [plan, { ...plan, id: 'long', ends_at: '2027-10-03' }] }).length, 0)
})
test('previously claimed, sent or uncertain notices are excluded by their durable key', () => {
  const [first] = select()
  assert.equal(select({ blockedKeys: [first.key] }).length, 0)
})
test('inactive members and contacts without opt-in are excluded', () => {
  assert.equal(select({ members: [{ ...member, status: 'Baja' }] }).length, 0)
  assert.equal(select({ contacts: [] }).length, 0)
  assert.equal(select({ contacts: [{ ...contact, whatsapp_opt_out_at: '2026-09-20T12:00:00Z' }] }).length, 0)
})
test('ambiguous phone numbers are not sent without normalization and consent', () => {
  assert.equal(select({ contacts: [{ ...contact, phone_e164: '099000000' }] }).length, 0)
})
test('calendar date uses Uruguay, not UTC', () => {
  assert.equal(dayInUruguay(new Date('2026-09-29T01:00:00Z')), '2026-09-28')
})
test('invalid calendar dates fail instead of silently selecting recipients', () => {
  assert.throws(() => select({ today: '2026-02-30' }), /Fecha inválida/)
})
