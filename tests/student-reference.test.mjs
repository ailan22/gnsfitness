import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'
const exports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/cloudTraining.ts',import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{exports})
const {lastExerciseResult}=exports
const exercise={id:'squat',name:'Sentadilla'}
const row=(id,date,load,extra={})=>({id,performed_at:date,created_at:date+'T12:00:00Z',routine_id:'routine',results:[{exerciseId:'squat',name:'Sentadilla',sets:'',reps:'',rir:'',load}],...extra})
test('previous exercise reference uses latest dated matching routine and exact exercise, without mutating history',()=>{
 const rows=[row('a','2026-09-01','20 kg'),row('b','2026-09-02','25 kg'),row('c','2026-10-01','30 kg'),row('d','2026-09-03','99 kg',{routine_id:'other'})]
 assert.equal(lastExerciseResult(rows,'routine',exercise,'2026-09-30').result.load,'25 kg')
 assert.equal(rows[0].id,'a')
})
test('renamed exercise and blank entries cannot supply a misleading load; zero is a result',()=>{
 const rows=[row('a','2026-09-01','0'),row('b','2026-09-02',''),row('c','2026-09-03','99',{results:[{exerciseId:'squat',name:'Otra variante',load:'99'}]})]
 assert.equal(lastExerciseResult(rows,'routine',exercise,'2026-09-30').result.load,'0')
 assert.equal(lastExerciseResult(rows,'new-routine',exercise,'2026-09-30'),null)
})
