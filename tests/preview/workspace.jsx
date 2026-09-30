// Isolated visual fixture. Not imported by index.html or the production build.
import React from 'react'
import { createRoot } from 'react-dom/client'
import CloudAdmin from '../../src/CloudAdmin'
import CloudStudent from '../../src/CloudStudent'
import '../../src/index.css'
import '../../src/App.css'
import '../../src/Workspace.css'
const date = new Date().toISOString().slice(0,10)
const tables = {
  members: [
    {id:'00000000-0000-4000-8000-000000000001',first_name:'Lucía',last_name:'Ejemplo',birth_date:'1994-05-15',joined_at:date,status:'Activo',email:'lucia@example.test',phone:'',trainer_name:'Profesional de prueba',goal:'Mejorar fuerza',welcome_form:'Bienvenida'},
    {id:'00000000-0000-4000-8000-000000000002',first_name:'Mateo',last_name:'Demostración',birth_date:'1988-03-20',joined_at:date,status:'Activo',email:'mateo@example.test',phone:'',trainer_name:'',goal:'',welcome_form:'Bienvenido'},
  ],
  memberships:[{id:'00000000-0000-4000-8000-000000000010',member_id:'00000000-0000-4000-8000-000000000001',plan_name:'Mensual',starts_at:date,ends_at:date,price:2100}],
  payments:[],routines:[],sessions:[],session_reviews:[],member_admin_notes:[],health_records:[],
}
const studentMode = new URLSearchParams(location.search).has('student')
const previewUser = {id:'demo-student'}
if(studentMode) { tables.members[0].user_id=previewUser.id; tables.routines.push({id:'routine',member_id:tables.members[0].id,name:'Programa de prueba',level:'Inicial',days_per_week:2,program_rounds:4,block_rounds:2,plan:{exercisesByDay:{1:[{id:'squat',name:'Sentadilla',sets:'3',reps:'10',rir:'2',rest:'90 segundos',load:'',notes:''}],2:[{id:'squat',name:'Sentadilla',sets:'3',reps:'10',rir:'2',rest:'90 segundos',load:'',notes:''}]}}}); tables.sessions.push({id:'previous',member_id:tables.members[0].id,routine_id:'routine',routine_name:'Programa de prueba',performed_at:'2026-09-01',created_at:'2026-09-01T12:00:00Z',day:1,block:1,week:1,notes:'',results:[{exerciseId:'squat',name:'Sentadilla',sets:'3',reps:'10',load:'20 kg',rir:'2'}]}); }
const client = {async rpc(_name,args){tables.sessions.unshift({id:args.p_request_id,member_id:tables.members[0].id,routine_id:args.p_routine_id,routine_name:'Programa de prueba',performed_at:args.p_performed_at,created_at:new Date().toISOString(),day:args.p_expected_day,block:1,week:args.p_expected_week,notes:args.p_notes,results:args.p_results});return {error:null}},from(table) {
  const query = { filters:[], start:0, end:999999, select(){return this}, order(){return this},
    eq(k,v){this.filters.push(row=>row[k]===v);return this}, in(k,values){this.filters.push(row=>values.includes(row[k]));return this},
    range(a,b){this.start=a;this.end=b;return this}, insert(row){this.newRow=row;return this},
    update(row){this.updated=row;return this}, upsert(row){this.newRow=row;return this}, single(){this.one=true;return this}, maybeSingle(){this.one=true;return this},
    then(resolve) {
      if(this.newRow) tables[table].push({...this.newRow,created_at:new Date().toISOString()})
      if(this.updated) for(const row of tables[table].filter(row=>this.filters.every(fn=>fn(row)))) Object.assign(row,this.updated)
      const all=this.newRow?[tables[table].at(-1)]:tables[table].filter(row=>this.filters.every(fn=>fn(row)))
      return Promise.resolve({data:this.one?(all[0]??null):all.slice(this.start,this.end+1),error:null,count:all.length}).then(resolve)
    }
  }; return query
}}
const mobile = new URLSearchParams(location.search).has('mobile')
createRoot(document.getElementById('root')).render(mobile ? <iframe title="Vista móvil" src={studentMode ? "/workspace-preview.html?student=1" : "/workspace-preview.html"} style={{width:390,height:844,border:0}}/> : <div className={studentMode ? "app" : "app app-admin"}><header className="topbar"><div className="brand"><img className="brand-logo" src="/gns-logo-transparent.png" alt=""/><span className="brand-copy"><span className="brand-title">GNS <span>FITNESS</span></span><span className="brand-motto">ENERGÍA · SALUD · BIENESTAR · VITALIDAD</span></span></div><span className="tag">Vista de prueba · datos ficticios</span></header><main className="content">{studentMode ? <CloudStudent client={client} user={previewUser}/> : <CloudAdmin client={client}/>}</main></div>)
