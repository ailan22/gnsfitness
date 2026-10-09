import HolisticSchedule from './HolisticSchedule'
import BotanicalCorners from './BotanicalCorners'
import PlanNotifications from './PlanNotifications'
import AdminRecipeLibrary from './AdminRecipeLibrary'
import AdminFoodGuide from './AdminFoodGuide'
import PersonalNutrition from './PersonalNutrition'
import NutritionMaterials from './NutritionMaterials'
import BackupPanel from './BackupPanel'
import PhysioDirectory from './PhysioDirectory'
import { ServiceNotifications } from './StudentWellbeing'
import AccountPrivacy from './AccountPrivacy'
import { Suspense, useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import CloudDashboard from './CloudDashboard'
import CloudMembers from './CloudMembers'

type Section = 'overview' | 'people' | 'nutrition' | 'physio' | 'holistic'
const sections: { id: Section; title: string; description: string; path: string }[] = [
  { id: 'overview', title: 'Resumen', description: 'El gimnasio hoy', path: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
  { id: 'people', title: 'Socios', description: 'Socios, planes y rutinas', path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0' },
  { id: 'nutrition', title: 'Nutrición', description: 'Solicitudes de acceso', path: 'M9 4H5v17h14V4h-4 M9 2h6v4H9z M8 11h8 M8 15h8' },
  { id: 'physio', title: 'Kinesiología', description: 'Evaluación y evolución', path: 'M3 12h4l3-8 4 16 3-8h4' },
  { id: 'holistic', title: 'Terapias holísticas', description: 'Reiki y Registros Akáshicos', path: 'M12 3v18 M3 12h18 M5 5l14 14 M5 19L19 5' },
]
export default function CloudAdmin({ client }: { client: SupabaseClient }) {
  const [section, setSection] = useState<Section>('overview')
  const [revision, setRevision] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [memberId, setMemberId] = useState('')
  const [newPerson, setNewPerson] = useState(false)
  const [memberFilter, setMemberFilter] = useState<'all' | 'expired' | 'pending'>('all')
  const countChanged = useCallback(() => { setRevision(value => value + 1) }, [])
  function navigate(next: Section, person = '', create = false, filter: 'all' | 'expired' | 'pending' = 'all') {
    if (dirty && !window.confirm('Hay información sin guardar. ¿Querés descartarla y cambiar de sección?')) return
    setDirty(false); setMemberFilter(filter); setMemberId(person); setNewPerson(create); setSection(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  return <div className="admin-workspace">
    <BotanicalCorners/>
    <PlanNotifications client={client} revision={revision} onOpen={id => navigate('people', id)}/><aside className="workspace-sidebar"><nav aria-label="Secciones de gestión">{sections.map(item => <button key={item.id} type="button" className={section === item.id ? 'workspace-nav active' : 'workspace-nav'} aria-current={section === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.path}/></svg><span><strong>{item.title}</strong></span>
    </button>)}</nav></aside>
    <div className="workspace-main" onInputCapture={event => { if ((event.target as HTMLElement).closest('form')) setDirty(true) }}><Suspense fallback={<p role="status">Cargando sección…</p>}>
      {section === 'overview' && <><CloudDashboard client={client} revision={revision} onOpenMembers={id => navigate('people', id)} onFilterMembers={filter => navigate('people', '', false, filter)}/><div className="workspace-shortcuts"><button type="button" className="card" onClick={() => navigate('people', '', true)}><strong>Registrar una persona</strong><small>Datos básicos y anamnesis opcional →</small></button><button type="button" className="card" onClick={() => navigate('physio')}><strong>Kinesiología</strong><small>Ver rehabilitaciones activas →</small></button><button type="button" className="card" onClick={() => navigate('holistic')}><strong>Terapias holísticas</strong><small>Reiki y Registros Akáshicos · agendar →</small></button></div></>}
      {section === 'people' && <CloudMembers key={`${memberId}-${memberFilter}-${newPerson}`} initialFilter={memberFilter} client={client} onCountChange={countChanged} initialNew={newPerson} initialMemberId={memberId || null} onDirtyChange={setDirty}/>}
      {section === 'physio' && <PhysioDirectory client={client} onDirtyChange={setDirty} onNewPerson={() => navigate('people', '', true)}/>} 
      {section === 'holistic' && <HolisticSchedule client={client} onOpen={id=>navigate('people',id)}/>}
      {section === 'nutrition' && <><NutritionMaterials client={client}/><ServiceNotifications client={client}/><PersonalNutrition client={client} onDirtyChange={setDirty}/><AdminFoodGuide/><AdminRecipeLibrary/></>}
      {section === 'overview' && <><AccountPrivacy client={client} admin/><BackupPanel client={client}/></>}
    </Suspense></div>
  </div>
}


