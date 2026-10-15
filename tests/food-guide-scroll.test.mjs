import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/studentGuideScroll.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports })

test('opening a recipe resets outer scrolling and places its heading below the fixed header', () => {
  const page = { scrollTop: 90, parentElement: null }
  const content = { scrollTop: 220, parentElement: page }
  const panel = { scrollTop: 700, parentElement: content, getBoundingClientRect: () => ({ top: 130 }), scrollTo({ top, behavior }) { this.scrollTop = top; assert.equal(behavior, 'instant') } }
  const target = { closest: () => panel, getBoundingClientRect: () => ({ top: 130 + 300 - panel.scrollTop }) }
  exports.showGuideStart(target)
  assert.equal(page.scrollTop, 0)
  assert.equal(content.scrollTop, 0)
  assert.equal(panel.scrollTop, 284)
  assert.equal(target.getBoundingClientRect().top, 146)
  panel.scrollTop = 900
  exports.showGuideStart(target)
  assert.equal(panel.scrollTop, 284, 'back navigation must also start at the heading')
})
