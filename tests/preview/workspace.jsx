// Isolated visual fixture. Not imported by index.html or the production build.
import React from 'react'
import { createRoot } from 'react-dom/client'
import CloudAdmin from '../../src/CloudAdmin'
import CloudStudent from '../../src/CloudStudent'
import BotanicalCorners from '../../src/BotanicalCorners'
import '../../src/index.css'
import '../../src/App.css'
import '../../src/Workspace.css'
const date = new Date().toISOString().slice(0,10)
const endDate = new Date(Date.now()+5*86400000).toISOString().slice(0,10)
const physioDate = new Date(Date.now()+2*86400000).toISOString().slice(0,10)
const tables = {
  room_appointments:[],program_results:[],
  members: [
    {id:'00000000-0000-4000-8000-000000000001',first_name:'Lucía',last_name:'Ejemplo',birth_date:'1994-05-15',joined_at:date,status:'Activo',email:'lucia@example.test',phone:'',trainer_name:'Profesional de prueba',goal:'Mejorar fuerza',welcome_form:'Bienvenida'},
    {id:'00000000-0000-4000-8000-000000000002',first_name:'Mateo',last_name:'Demostración',birth_date:'1988-03-20',joined_at:date,status:'Activo',email:'mateo@example.test',phone:'',trainer_name:'',goal:'',welcome_form:'Bienvenido'},
  ],
  memberships:[{id:'00000000-0000-4000-8000-000000000010',member_id:'00000000-0000-4000-8000-000000000001',plan_name:'Mensual + Kinesiología',months:1,service_extras:['Kinesiología'],service_details:'',starts_at:date,ends_at:endDate,price:2750,service_config:{version:1,nutritionMonthly:3000,nutritionMonths:0,physioSessionPrice:650,physioDates:[physioDate]}}],
  nutrition_drafts:[],nutrition_plans:[],privacy_requests:[],member_progress:[],service_requests:[],payments:[],routines:[],sessions:[],session_reviews:[],member_admin_notes:[],health_records:[],
}
tables.health_records.push({ id:'physio-demo', member_id:tables.members[0].id, kind:'physio_assessment', occurred_on:date, created_at:new Date().toISOString(), professional:'Profesional de prueba', registration:'', correction_of:null, correction_reason:'', episode_id:null, payload:{region:'Rodilla derecha', reason:'Evaluación ficticia para comprobar la ficha'} });
const studentMode = new URLSearchParams(location.search).has('student')
const storeScreen = new URLSearchParams(location.search).get('store')
if (storeScreen) {
  tables.members[0].trainer_name = 'Equipo GNS'
  tables.program_results.push({member_id:tables.members[0].id,routine_id:'previous-program',program_name:'Preparación inicial · ejemplo',evaluated_on:date,observations:'Registro de demostración: completaste el programa y mejoraste la regularidad de tus entrenamientos.',comparison:'Ejemplo ficticio de seguimiento compartido por el entrenador.',next_steps:'Continuar con una progresión de cargas adaptada y revisar la técnica.',revision:1})
  tables.member_progress = [70,69.5,69,68.5].map((value,i)=>({id:`progress-${i}`,member_id:tables.members[0].id,metric:'weight',value,measured_on:`2026-09-${String(1+i*7).padStart(2,'0')}`}))
}
if(studentMode && (storeScreen || new URLSearchParams(location.search).has('nutrition-enabled'))) tables.service_requests.push({id:'enabled-demo',member_id:tables.members[0].id,service:'nutrition',status:'enabled',nutrition_guides:(storeScreen || new URLSearchParams(location.search).has('food-only'))?['food']:[],created_at:new Date().toISOString()});
const previewUser = {id:'demo-student'}; tables.members[0].user_id=previewUser.id; tables.nutrition_plans.push({id:'plan-demo',member_id:tables.members[0].id,title:'Plan de alimentación · Ejemplo',body:'Desayuno\nYogur con avena y fruta.\n\nAlmuerzo\nPollo con arroz y verduras.\n\nIndicaciones\nEjemplo ficticio para revisar la pantalla.',active:true,draft_revision:1,published_at:new Date().toISOString()})
if(studentMode) { tables.members[0].user_id=previewUser.id; tables.routines.push({id:'routine',member_id:tables.members[0].id,name:'Programa de prueba',level:'Inicial',days_per_week:2,program_rounds:4,block_rounds:2,plan:{exercisesByDay:{1:[{id:'squat',name:'Sentadilla',sets:'3',reps:'10',rir:'2',rest:'90 segundos',load:'',notes:''}],2:[{id:'squat',name:'Sentadilla',sets:'3',reps:'10',rir:'2',rest:'90 segundos',load:'',notes:''}]}}}); tables.sessions.push({id:'previous',member_id:tables.members[0].id,routine_id:'routine',routine_name:'Programa de prueba',performed_at:'2026-09-01',created_at:'2026-09-01T12:00:00Z',day:1,block:1,week:1,notes:'',results:[{exerciseId:'squat',name:'Sentadilla',sets:'3',reps:'10',load:'20 kg',rir:'2'}]}); }
if(!studentMode) tables.service_requests.push({id:'request-demo',member_id:tables.members[0].id,service:'nutrition',status:'pending',created_at:new Date().toISOString()});
const client = {async rpc(_name,args){if(_name==='admin_dashboard')return {error:null,data:{date,page:args.p_page,pageSize:25,members:2,active:2,joined:2,inactive:0,income:0,monthlyIncome:0,routines:0,sessions:0,expired:0,expiring:1,pending:2750,debtors:1,withoutPlan:1,plans:[{name:'Mensual + Kinesiología',count:1}],pendingMembers:[{...tables.members[0],plan_name:'Mensual + Kinesiología',balance:2750}]}};if(_name==='save_nutrition_draft'){tables.nutrition_drafts=[{member_id:args.p_member,title:args.p_title,body:args.p_body,assessment:args.p_assessment,revision:args.p_expected+1}];return {data:args.p_expected+1,error:null}}if(_name==='assign_nutrition_guides'){tables.service_requests[0].nutrition_guides=args.p_guides;tables.service_requests[0].status='enabled';return {error:null}}if(_name==='enable_personal_nutrition'){tables.service_requests[0].status='enabled';return {error:null}}if(_name==='publish_nutrition_plan'){return {error:null}}if(_name==='withdraw_nutrition_plan'){return {error:null}}if(_name==='request_nutrition_access'){tables.service_requests.push({id:'request-demo',member_id:tables.members[0].id,service:'nutrition',status:'pending',created_at:new Date().toISOString()});return {data:'request-demo',error:null}} if(_name==='decide_service_request'){tables.service_requests.find(r=>r.id===args.p_id).status=args.p_status;return {error:null}} tables.sessions.unshift({id:args.p_request_id,member_id:tables.members[0].id,routine_id:args.p_routine_id,routine_name:'Programa de prueba',performed_at:args.p_performed_at,created_at:new Date().toISOString(),day:args.p_expected_day,block:1,week:args.p_expected_week,notes:args.p_notes,results:args.p_results});return {error:null}},from(table) {
  const query = { filters:[], start:0, end:999999, select(){return this}, order(){return this},
    eq(k,v){this.filters.push(row=>k==='service_config'?JSON.stringify(row[k])===v:row[k]===v);return this}, in(k,values){this.filters.push(row=>values.includes(row[k]));return this},
    range(a,b){this.start=a;this.end=b;return this}, insert(row){this.newRow=row;return this},
    delete(){this.removing=true;return this}, update(row){this.updated=row;return this}, upsert(row){this.newRow=row;return this}, single(){this.one=true;return this}, maybeSingle(){this.one=true;return this},
    then(resolve) {
      if(this.removing) tables[table]=tables[table].filter(row=>!this.filters.every(fn=>fn(row)))
      if(this.newRow) tables[table].push({...this.newRow,created_at:new Date().toISOString()})
      const matched = tables[table].filter(row=>this.filters.every(fn=>fn(row)))
      if(this.updated) for(const row of matched) Object.assign(row,this.updated)
      const all=this.newRow?[tables[table].at(-1)]:matched
      return Promise.resolve({data:structuredClone(this.one?(all[0]??null):all.slice(this.start,this.end+1)),error:null,count:all.length}).then(resolve)
    }
  }; return query
}}
const mobile = new URLSearchParams(location.search).has('mobile')
if(studentMode && new URLSearchParams(location.search).has('test-day')) { tables.routines[0].plan.exercisesByDay[2]=[]; tables.routines[0].plan.sessionTests={1:{2:[{id:'test-example',title:'Evaluación de progreso',details:'Realizá la prueba supervisada y anotá el resultado.'}]}} }
const student = <><BotanicalCorners/><CloudStudent client={client} user={previewUser}/></>
createRoot(document.getElementById('root')).render(mobile ? <iframe title="Vista móvil" src={"/workspace-preview.html?" + new URLSearchParams([...new URLSearchParams(location.search)].filter(([key])=>key!=="mobile")).toString()} style={{width:390,height:844,border:0}}/> : <div className={studentMode ? "app" : "app app-admin"}><header className="topbar"><div className="brand">{!storeScreen && <img className="brand-logo" src="/gns-logo-transparent.png" alt=""/>}<span className="brand-copy"><span className="brand-title">GNS <span>FITNESS</span></span><span className="brand-motto">ENERGÍA · SALUD · BIENESTAR · VITALIDAD</span></span></div><span className="tag">{storeScreen ? 'Portal del alumno' : 'Vista de prueba · datos ficticios'}</span></header><main className="content">{studentMode ? storeScreen ? <div className="cloud-entry"><section className="card cloud-account cloud-portal"><div className="student-account-layout">{student}<div className="student-account-bottom"><details className="biometric-settings"><summary>Acceso con Face ID o biometría</summary><p>Configuración de prueba.</p></details><button className="secondary cloud-signout" aria-label="Cerrar sesión">↪</button></div></div><nav className="account-legal"><a href="#">Privacidad</a><a href="#">Ayuda y soporte</a></nav></section></div> : student : <CloudAdmin client={client}/>}</main></div>)
if (storeScreen && storeScreen !== 'home') {
  const timer = setInterval(() => {
    const position = { training: 1, nutrition: 2, results: 4 }[storeScreen]
    const selector = `.student-home-menu nav button:nth-child(${position})`
    const button = document.querySelector(selector)
    if (button) { button.click(); clearInterval(timer) }
  },100)
  setTimeout(()=>clearInterval(timer),10000)
}

