import type { CloudPlan } from './cloudTraining'
import type { Exercise } from './data'

export const routineExample = `Semanas 1-4
Día 1
Sentadilla | 3 | 10 | RIR 2 | Descanso 90 s
Remo | 3 | 12 | RIR 2
Indicaciones: Priorizar la técnica.
Día 2
Peso muerto rumano 3x10
Prueba: Movilidad de tobillo — Realizar según las indicaciones del entrenador.
Semanas 5-8
Día 1
Sentadilla | 4 | 8 | RIR 2
Día 2
Peso muerto rumano 4x8`

export type ImportedSession = { week:number; day:number; exercises:Exercise[]; guidance:string; tests:{id:string;title:string;details:string}[] }
const normalizeLine = (line:string) => line.trim().replace(/\*\*/g,'').replace(/^#+\s*/, '').replace(/^[•*]\s*/, '').replace(/^\d+[.)]\s*/, '').replace(/^mes\s+\d+\s*[—–:-]\s*/i,'')
const weekHeader = /^semanas?\s+([\d\s,yY–—-]+|\d+\s+a\s+\d+)\s*:?(?:\s*\([^)]*\))?$/i
const dayHeader = /^d[ií]a\s+(\d+)\s*(?:[:—–-]\s*(.*))?$/i
export function detectRoutineDimensions(text:string) {
 let weeks=0,days=0
 for(const raw of text.split(/\r?\n/)) {
  const line=normalizeLine(raw), range=line.match(weekHeader),day=line.match(dayHeader)
  if(range) for(const n of range[1].match(/\d+/g)??[]) weeks=Math.max(weeks,Number(n))
  if(day) days=Math.max(days,Number(day[1]))
 }
 return {weeks,days}
}
export function parseRoutine(text:string, weeks:number, days:number, blockWeeks:number) {
 const errors:string[]=[], sessions=new Map<string,ImportedSession>()
 let selectedWeeks:number[]=[], day=0
 if(!Number.isInteger(weeks)||weeks<1||weeks>104||!Number.isInteger(days)||days<1||days>7||!Number.isInteger(blockWeeks)||blockWeeks<1||blockWeeks>weeks) return {errors:['Revisá la duración, los bloques y los días antes de importar.'],sessions:[],plan:{} as CloudPlan}
 if(text.length>200000) return {errors:['El texto supera los 200.000 caracteres.'],sessions:[],plan:{} as CloudPlan}
 const lines=text.split(/\r?\n/)
 for(let i=0;i<lines.length;i++){
  const line=normalizeLine(lines[i])
  if(!line)continue
  const fail=(message:string)=>errors.push(`Línea ${i+1}: ${message}`)
  const range=line.match(weekHeader)
  if(range){day=0;selectedWeeks=[];for(const part of range[1].split(/\s*[,y]\s*/i)){const match=part.trim().match(/^(\d+)(?:\s*(?:-|–|—|a)\s*(\d+))?$/i);if(!match){fail('la lista de semanas no se reconoce.');continue}const from=Number(match[1]),to=Number(match[2]||match[1]);if(from<1||to<from||to>weeks){fail('el rango de semanas queda fuera del programa.');continue}selectedWeeks.push(...Array.from({length:to-from+1},(_,n)=>from+n))}selectedWeeks=[...new Set(selectedWeeks)];continue}
  const dayMatch=line.match(dayHeader)
  if(dayMatch){day=Number(dayMatch[1]);if(!selectedWeeks.length||day<1||day>days){fail('indicá primero la semana y un día válido.');day=0;continue}for(const week of selectedWeeks){const key=`${week}/${day}`;if(sessions.has(key)){fail(`la semana ${week}, día ${day}, está repetida.`)}else sessions.set(key,{week,day,exercises:[],guidance:dayMatch[2]?.trim()||'',tests:[]})}continue}
  if(!selectedWeeks.length||!day){fail('falta un encabezado «Semana 1» y «Día 1».');continue}
  const targets=selectedWeeks.map(week=>sessions.get(`${week}/${day}`)!)
  const note=line.match(/^indicaciones?\s*:\s*(.+)$/i)
  if(note){targets.forEach(s=>{s.guidance+=(s.guidance?'\n':'')+note[1]});continue}
  const exam=line.match(/^prueba\s*:\s*(.+)$/i)
  if(exam){if(exam[1].length>4000){fail('la prueba es demasiado extensa.');continue}targets.forEach(s=>s.tests.push({id:crypto.randomUUID(),title:'Prueba',details:exam[1]}));continue}
  let name='',sets='',reps='',extra:string[]=[]
  if(line.includes('|')){const parts=line.split('|').map(v=>v.trim());[name,sets,reps]=parts;extra=parts.slice(3)}
  else {const parts=line.split(/[·;|]/).map(x=>x.trim());const match=parts[0].match(/^(.+?)\s+(\d+)\s*[x×]\s*(.+)$/i);if(match){[,name,sets,reps]=match;name=name.replace(/\s*[—–-]\s*$/,'');const tail=reps.match(/^(.*?)\s+((?:RIR|descanso|carga|tempo)\s+.*)$/i);if(tail){reps=tail[1];extra.push(tail[2])}extra.push(...parts.slice(1))}}
  if(!name?.trim()||!sets||!reps||name.length>120||sets.length>120||reps.length>120){fail('no se reconoció el ejercicio. Usá «Sentadilla | 3 | 10 | RIR 2» o «Sentadilla 3x10».');continue}
  const exercise:Exercise={id:crypto.randomUUID(),name:name.trim(),sets,reps,load:'',rir:'',rest:'',tempo:'',notes:''}
  for(const field of extra){const match=field.match(/^(RIR|descanso|carga|tempo|nota|notas)\s*:?\s+(.+)$/i);if(!match){fail(`no se reconoce «${field}»; usá RIR, Descanso, Carga, Tempo o Nota.`);continue}const key=({rir:'rir',descanso:'rest',carga:'load',tempo:'tempo',nota:'notes',notas:'notes'} as const)[match[1].toLowerCase() as 'rir'];exercise[key]=match[2]}
  targets.forEach(s=>s.exercises.push({...exercise}))
 }
 const result=[...sessions.values()].sort((a,b)=>a.week-b.week||a.day-b.day)
 if(!result.length) errors.push('No se encontraron sesiones para importar.')
 for(const session of result){if(!session.exercises.length&&!session.tests.length)errors.push(`Semana ${session.week}, día ${session.day}: agregá ejercicios o una prueba.`)}
 const plan:CloudPlan={exercisesByDay:{},blockExercises:{},weekExercises:{},sessionGuidance:{},sessionTests:{}}
 // Explicitly clear unspecified days: an import must never invent or inherit a future week.
 for(let absolute=1;absolute<=weeks;absolute++)for(let d=1;d<=days;d++){
  const block=Math.floor((absolute-1)/blockWeeks)+1,week=(absolute-1)%blockWeeks+1
  const session=sessions.get(`${absolute}/${d}`),items=session?.exercises||[]
  if(week===1){if(block===1)plan.exercisesByDay![d]=items;else{plan.blockExercises![block]??={};plan.blockExercises![block][d]=items}}
  else{plan.weekExercises![block]??={};plan.weekExercises![block][week]??={};plan.weekExercises![block][week][d]=items}
  plan.sessionGuidance![block]??={};plan.sessionGuidance![block][week]??={};plan.sessionGuidance![block][week][d]=session?.guidance||''
  if(session?.tests.length){plan.sessionTests![absolute]??={};plan.sessionTests![absolute][d]=session.tests}
 }
 return {errors,sessions:result,plan}
}
