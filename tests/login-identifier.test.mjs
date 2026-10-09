import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/loginIdentifier.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports })
const { loginIdentifier } = exports

test('email remains intact and phone numbers require an explicit international prefix', () => {
  assert.equal(loginIdentifier(' socio@example.com ').email, 'socio@example.com')
  for (const phone of ['+59899123456', '+54 (11) 1234-5678', '+55 11 91234-5678', '+52 55 1234 5678']) {
    assert.equal(loginIdentifier(phone).phone, phone.replace(/[ ()-]/g, ''))
  }
})
test('ambiguous local numbers, extensions and malformed identifiers are rejected', () => {
  for (const input of ['099123456', '59899123456', '+099123456', '+59899abc123', '+59899123456 ext 1', '+1', '+1234567890123456', 'a@@b.com', 'a b@c.com', '']) {
    assert.equal(loginIdentifier(input), null, input)
  }
})
