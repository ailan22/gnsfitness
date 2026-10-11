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
 gym_business_settings:[{id:'00000000-0000-0000-0000-000000000001',tax_regime:'IVA mínimo',employee_count:1,version:1}],
 gym_expenses: new URLSearchParams(location.search).has('expenses-demo') ? [['Alquiler','Alquiler del local',28000,'paid'],['Sueldos','Sueldos del equipo',62000,'paid'],['BPS y aportes','Aportes mensuales',14500,'pending'],['Luz','Electricidad del gimnasio',4800,'pending'],['Agua','Consumo de agua',1800,'pending'],['Mantenimiento de equipos','Mantenimiento preventivo',6500,'pending']].map(([category,concept,amount,status],i)=>({id:crypto.randomUUID(),category,concept,amount_cents:amount*100,status,expense_type:'fixed',due_date:date.slice(0,7)+'-'+String(5+i*3).padStart(2,'0'),paid_date:status==='paid'?date:null,notes:'Datos ficticios de demostración',version:1})) : [],
  room_appointments:new URLSearchParams(location.search).has('agenda-demo')?['physio','reiki','akashic'].map((kind,index)=>({id:`agenda-${index}`,member_id:'00000000-0000-4000-8000-000000000001',membership_id:null,kind,session_date:date,starts_at:`${date}T${['08:00','09:10','16:35'][index]}:00-03:00`,ends_at:`${date}T${['08:35','09:45','17:10'][index]}:00-03:00`,cancelled:false})):[],program_results:[],registration_requests:[],
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
if(new URLSearchParams(location.search).has('admin-workflow')) {
  tables.memberships[0].starts_at='2026-01-01'; tables.memberships[0].ends_at='2026-01-31';
  tables.memberships[0].service_extras=[]; tables.memberships[0].service_config=null;
  tables.memberships[0].plan_name='Mensual · 3 días por semana'; tables.memberships[0].price=2100;
  tables.health_records=Array.from({length:12},(_,i)=>({id:`print-fixture-${i}`,member_id:tables.members[0].id,kind:'training_intake',occurred_on:'2026-01-01',created_at:'2026-01-01T12:00:00Z',professional:'Profesional de prueba',registration:'',payload:{goals:'Mejorar fuerza y movilidad',activity:'Actividad moderada',history:'Sin antecedentes referidos'},correction_of:null,episode_id:null,correction_reason:''}));
}
const client = {async rpc(_name,args){if(_name==='save_gym_business_settings'){Object.assign(tables.gym_business_settings[0],{tax_regime:args.p_tax_regime,employee_count:args.p_employee_count,version:tables.gym_business_settings[0].version+1});return {error:null,data:tables.gym_business_settings[0].version}}if(_name==='save_gym_expense'){const row=tables.gym_expenses.find(r=>r.id===args.p_id);if(row)Object.assign(row,args.p_data,{version:row.version+1});else tables.gym_expenses.push({id:args.p_id,...args.p_data,version:1});return {error:null,data:1}}if(_name==='book_holistic_session'){const starts=new Date(args.p_date+'T'+args.p_time+':00-03:00');tables.room_appointments.push({id:args.p_id,member_id:args.p_member,kind:args.p_kind,session_date:args.p_date,starts_at:starts.toISOString(),ends_at:new Date(starts.getTime()+35*60000).toISOString(),cancelled:false,membership_id:null});return {error:null}}if(_name==='cancel_holistic_session'){tables.room_appointments.find(a=>a.id===args.p_id).cancelled=true;return {error:null}}if(_name==='create_membership_period'){tables.memberships.unshift(args.p_row);return {error:null,data:args.p_row.id}} if(_name==='register_membership_payment'){tables.payments.push({id:args.p_request_id,member_id:args.p_member_id,membership_id:args.p_membership_id,paid_at:args.p_paid_at,amount:args.p_amount_cents/100,method:args.p_method});return {error:null,data:args.p_request_id}}if(_name==='admin_dashboard')return {error:null,data:{date,page:args.p_page,pageSize:25,members:2,active:2,joined:2,inactive:0,income:0,monthlyIncome:0,routines:0,sessions:0,expired:new URLSearchParams(location.search).has('admin-workflow')?1:0,expiring:1,pending:2750,debtors:1,withoutPlan:1,plans:[{name:'Mensual + Kinesiología',count:1}],pendingMembers:[{...tables.members[0],plan_name:'Mensual + Kinesiología',balance:2750}]}};if(_name==='save_nutrition_draft'){tables.nutrition_drafts=[{member_id:args.p_member,title:args.p_title,body:args.p_body,assessment:args.p_assessment,revision:args.p_expected+1}];return {data:args.p_expected+1,error:null}}if(_name==='assign_nutrition_guides'){tables.service_requests[0].nutrition_guides=args.p_guides;tables.service_requests[0].status='enabled';return {error:null}}if(_name==='enable_personal_nutrition'){tables.service_requests[0].status='enabled';return {error:null}}if(_name==='publish_nutrition_plan'){return {error:null}}if(_name==='withdraw_nutrition_plan'){return {error:null}}if(_name==='request_nutrition_access'){tables.service_requests.push({id:'request-demo',member_id:tables.members[0].id,service:'nutrition',status:'pending',created_at:new Date().toISOString()});return {data:'request-demo',error:null}} if(_name==='decide_service_request'){tables.service_requests.find(r=>r.id===args.p_id).status=args.p_status;return {error:null}} tables.sessions.unshift({id:args.p_request_id,member_id:tables.members[0].id,routine_id:args.p_routine_id,routine_name:'Programa de prueba',performed_at:args.p_performed_at,created_at:new Date().toISOString(),day:args.p_expected_day,block:1,week:args.p_expected_week,notes:args.p_notes,results:args.p_results});return {error:null}},from(table) {
  const query = { filters:[], start:0, end:999999, select(){return this}, order(){return this},
    eq(k,v){this.filters.push(row=>k==='service_config'?JSON.stringify(row[k])===v:row[k]===v);return this}, in(k,values){this.filters.push(row=>values.includes(row[k]));return this},
    gte(k,v){this.filters.push(row=>row[k]>=v);return this}, lte(k,v){this.filters.push(row=>row[k]<=v);return this}, range(a,b){this.start=a;this.end=b;return this}, insert(row){this.newRow=row;return this},
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


if(new URLSearchParams(location.search).has('expenses-demo')){const t=setInterval(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Gastos');if(b){b.click();clearInterval(t)}},100);setTimeout(()=>clearInterval(t),10000)}

if(new URLSearchParams(location.search).has("top-nav-demo")){import("./top-nav-demo.css")}

if(new URLSearchParams(location.search).has("top-nav-alternative")){import("./top-nav-alternative.css")}
