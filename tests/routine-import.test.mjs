import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {webcrypto} from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
const compile=file=>ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText
const api={},training={}
vm.runInNewContext(compile('routineImport.ts'),{exports:api,crypto:webcrypto})
vm.runInNewContext(compile('cloudTraining.ts'),{exports:training})
test('real supplied 12-week routine preserves all 276 exercises, deloads, sides, distances and RIR ranges',()=>{
 const text=readFileSync(new URL('./fixtures/macrocycle-12-weeks.txt',import.meta.url),'utf8')
 const result=api.parseRoutine(text,24,3,4)
 assert.deepEqual([...result.errors],[])
 assert.equal(result.sessions.length,36)
 assert.equal(result.sessions.reduce((sum,s)=>sum+s.exercises.length,0),276)
 const find=(week,day)=>result.sessions.find(s=>s.week===week&&s.day===day).exercises
 assert.equal(find(1,1)[0].name,'Sentadilla con barra')
 assert.equal(find(1,1)[0].sets,'3')
 assert.equal(find(4,1)[0].sets,'2')
 assert.equal(find(4,1)[0].rir,'4')
 assert.equal(find(5,1)[1].sets,'4')
 assert.equal(find(5,1)[3].rir,'1–2')
 assert.equal(find(1,2)[3].reps,'8–10 por pierna')
 assert.equal(find(1,3)[7].reps,'25 m por lado')
 assert.equal(find(12,3)[7].rest,'90 s.')
 assert.equal(training.plannedExercises(result.plan,1,4,1,4,24).length,0)
})
test('52-week import preserves ranges, fields, exact test dates, and does not invent future sessions',()=>{
 const result=api.parseRoutine('Semanas 1-4\nDía 1\nSentadilla | 3 | 10 | RIR 2 | Carga 20 kg | Descanso 90 s\nPrueba: Evaluación inicial\nSemanas 5-24\nDía 1\nRemo 4x8',52,2,4)
 assert.deepEqual([...result.errors],[])
 assert.equal(result.sessions.length,24)
 assert.equal(training.plannedExercises(result.plan,1,1,4,4,52)[0].name,'Sentadilla')
 assert.equal(training.plannedExercises(result.plan,1,2,1,4,52)[0].name,'Remo')
 assert.equal(training.plannedExercises(result.plan,1,7,1,4,52).length,0)
 assert.equal(training.plannedExercises(result.plan,2,1,1,4,52).length,0)
 assert.equal(result.plan.sessionTests['4']['1'][0].details,'Evaluación inicial')
 assert.equal(result.plan.sessionTests['5'],undefined)
 assert.equal(result.sessions[0].exercises[0].load,'20 kg')
})
test('malformed input, duplicate sessions and out-of-range weeks cannot be silently imported',()=>{
 for(const text of ['Día 1\nSentadilla 3x10','Semana 53\nDía 1\nRemo 3x10','Semana 1\nDía 1\nRemo 3x10\nDía 1\nRemo 3x10','Semana 1\nDía 1\nHacer todo más intenso','Semana 1\nDía 1\nRemo | 3 | 10 | desconocido']) assert.ok(api.parseRoutine(text,52,3,4).errors.length)
})
test('24-week program with explicit full range fills exactly those days',()=>{
 const result=api.parseRoutine('Semanas 1-24\nDía 1\nRemo 3x10\nDía 2\nSentadilla 3x8',24,2,4)
 assert.equal(result.sessions.length,48)
 assert.equal(result.errors.length,0)
 assert.equal(training.plannedExercises(result.plan,2,6,4,4,24)[0].name,'Sentadilla')
})
