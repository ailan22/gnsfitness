import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/readAllPages.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, { exports })
const { readAllPages } = exports
for (const size of [0, 499, 500, 999, 1000, 1001, 2500]) {
 test(`reads all ${size} rows without dropping the last page`, async () => {
  const rows = Array.from({ length: size }, (_, id) => ({ id })); let calls = 0
  const result = await readAllPages(async (from,to) => { calls++; assert.equal(to-from,499); return { data: rows.slice(from,to+1), count: size, error: null } })
  assert.equal(result.error,null); assert.equal(result.data.length,size)
  assert.equal(new Set(result.data.map(r=>r.id)).size,size)
  assert.equal(calls,Math.max(1,Math.ceil(size/500)))
 })
}
test('continues if server enforces a smaller page size', async () => {
 const rows = Array.from({length:1001},(_,id)=>({id}))
 const result = await readAllPages(async from => ({data:rows.slice(from,from+100),count:1001,error:null}))
 assert.equal(result.data.length,1001)
})
test('never exposes a partial list after a later network failure', async () => {
 const result = await readAllPages(async from => { if(from) throw Error('offline'); return {data:Array(500).fill({id:1}),count:1001,error:null} })
 assert.equal(result.data,null); assert.ok(result.error)
})
test('count changing during pagination requires a new read', async () => {
 const result = await readAllPages(async from => ({data:Array(500).fill({}),count:from?1002:1001,error:null}))
 assert.equal(result.data,null); assert.ok(result.error)
})
test('missing count, incomplete and excessive responses fail closed', async () => {
 for(const page of [{data:[],count:null,error:null},{data:[],count:10,error:null},{data:[],count:100001,error:null},{data:null,count:0,error:null}]) {
  const result = await readAllPages(async()=>page); assert.equal(result.data,null); assert.ok(result.error)
 }
})
test('permission errors are returned without any data', async () => {
 const result = await readAllPages(async()=>({data:null,count:null,error:{code:'42501'}}))
 assert.equal(result.data,null); assert.equal(result.error.code,'42501')
})

test('same-size concurrent changes cannot silently duplicate records or payment totals', async () => {
 const rows = Array.from({length:501},(_,id)=>({id,amount:100}))
 const result = await readAllPages(async from => ({data:from ? [rows[499]] : rows.slice(0,500),count:501,error:null}))
 assert.equal(result.data,null); assert.ok(result.error)
})
