import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/recoveryUrl.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { recoveryUrl, publicAppOrigin } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('native Android and iOS recovery emails use the public site', () => {
  for (const origin of ['https://localhost', 'capacitor://localhost']) {
    assert.equal(recoveryUrl(true, origin), `${publicAppOrigin}/reset-password`)
  }
})
test('web development and production retain their current recovery origin', () => {
  for (const origin of ['http://localhost:5173', publicAppOrigin]) {
    assert.equal(recoveryUrl(false, origin), `${origin}/reset-password`)
  }
})
