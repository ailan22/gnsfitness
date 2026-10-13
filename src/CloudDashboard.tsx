import './DashboardAgenda.css'
import DashboardAgenda from './DashboardAgenda'
import DashboardIcon from './DashboardIcon'
import ExpiredMembers from './ExpiredMembers'
import { useEffect, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Snapshot = {
  date: string; page: number; pageSize: number; members: number; active: number; joined: number; inactive: number
  income: number; monthlyIncome: number; routines: number; sessions: number; expired: number; expiring: number
  pending: number; debtors: number; withoutPlan: number
  plans: { name: string; count: number }[]
  pendingMembers: { id: string; first_name: string; last_name: string; plan_name: string; balance: number }[]
}
const money = (value: number) => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(value)

export default function CloudDashboard({ client, revision, onOpenMembers, registration }: { client: SupabaseClient; revision: number; registration?: ReactNode; onOpenMembers?: (memberId?: string) => void; onFilterMembers?: (filter: 'expired' | 'pending') => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshCount, setRefreshCount] = useState(0)
  const [page, setPage] = useState(0)
  const [expiredOpen,setExpiredOpen]=useState(false)
  useEffect(() => {
    let active = true, busy = false
    const refresh = async () => {
      if (!active || busy) return
      busy = true
      setLoading(true)
      try {
        const { data, error: failure } = await client.rpc('admin_dashboard', { p_page: page })
        if (failure || !data || !Array.isArray(data.pendingMembers) || data.page !== page) throw new Error('dashboard')
        if (active) { setSnapshot(data as Snapshot); setError('') }
      } catch {
        if (active) { setSnapshot(null); setError('No se pudieron consultar los indicadores. Intentá actualizar nuevamente.') }
      } finally { busy = false; if (active) setLoading(false) }
    }
    const timer = setTimeout(() => { void refresh() }, 0)
    const whenReturning = () => { if (document.visibilityState === 'visible') void refresh() }
    const reminderTimer = setInterval(whenReturning, 60_000)
    window.addEventListener('focus', whenReturning)
    return () => { active = false; clearTimeout(timer); clearInterval(reminderTimer); window.removeEventListener('focus', whenReturning) }
  }, [client, revision, refreshCount, page])
  return <section className="cloud-dashboard dashboard-agenda-layout" aria-label="Indicadores del gimnasio">
    <div className="heading"><div><p className="eyebrow">GNS FITNESS · VISIÓN GENERAL</p><h1>Panel de gestión</h1></div>
      <div className="dashboard-header-tools"><time className="dashboard-date">{new Intl.DateTimeFormat('es-UY',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'America/Montevideo'}).format(new Date())}</time><button type="button" className="secondary" onClick={() => setRefreshCount(value => value + 1)} disabled={loading}>Actualizar</button></div></div>
    <p className="muted">Lo importante de tu gimnasio, en un solo lugar.</p>
    {loading && !snapshot ? <p>Cargando indicadores…</p> : null}
    {error && <p role="alert" className="error">{error}</p>}
    {snapshot && <><div className="stats dashboard-primary">
      <div className="card"><DashboardIcon kind="members"/><span>Socios activos</span><strong>{snapshot.active}</strong><small>{snapshot.members} personas registradas</small></div>
      <div className="card"><DashboardIcon kind="income"/><span>Ingresos del mes</span><strong className="amount">{money(snapshot.monthlyIncome)}</strong><small>Pagos registrados este mes</small></div>
      <details className="card expired-card" onToggle={e=>setExpiredOpen(e.currentTarget.open)}><summary><DashboardIcon kind="expired"/><span>Planes vencidos</span><strong className="red">{snapshot.expired}</strong></summary>{expiredOpen&&<ExpiredMembers key={`${revision}-${refreshCount}`} client={client} date={snapshot.date} onSelect={id=>onOpenMembers?.(id)}/>}</details>
    </div>
    <div className="dashboard-details">
      <section className="card dashboard-pending" aria-labelledby="dashboard-pending-title"><div className="management-card-heading"><h2 id="dashboard-pending-title">Pagos pendientes</h2><span className="badge">{snapshot.debtors} {snapshot.debtors === 1 ? 'socio' : 'socios'}</span></div>
        <div className="pending-columns" aria-hidden="true"><span>Socio</span><span>Plan</span><span>Saldo</span><span/></div>
        {snapshot.debtors === 0 ? <p>Sin saldos pendientes.</p> : <><ul className="dashboard-breakdown dashboard-pending-list">
          {snapshot.pendingMembers.map(member => <li key={member.id}>
            <button type="button" className="text-button pending-member-name" onClick={() => onOpenMembers?.(member.id)}>{member.first_name} {member.last_name}</button><span className="pending-plan">{member.plan_name}</span>
            <strong>{money(member.balance)}</strong><button className="text-button pending-open" type="button" aria-label={`Abrir ficha de ${member.first_name} ${member.last_name}`} onClick={()=>onOpenMembers?.(member.id)}>›</button></li>)}
        </ul><div className="pending-total"><span>Total</span><strong>{money(snapshot.pending)} pendientes</strong></div>{snapshot.debtors > snapshot.pageSize && <div className="actions" aria-label="Páginas de pagos pendientes">
          <button type="button" className="secondary" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button>
          <span>Página {page + 1} de {Math.max(1, Math.ceil(snapshot.debtors / snapshot.pageSize))}</span>
          <button type="button" className="secondary" disabled={loading || (page + 1) * snapshot.pageSize >= snapshot.debtors} onClick={() => setPage(value => value + 1)}>Siguiente</button>
        </div>}</>}
      </section>
      <DashboardAgenda client={client} revision={revision+refreshCount} onOpen={onOpenMembers}/>
    </div>          <div className="dashboard-bottom-row">{registration}<details className="additional-metrics"><summary>Más indicadores de actividad</summary><div className="stats">
      <div className="card"><span>Altas del mes</span><strong>{snapshot.joined}</strong></div>
      <div className="card"><span>Bajas registradas</span><strong>{snapshot.inactive}</strong></div>
      <div className="card"><span>Ingresos acumulados</span><strong className="amount">{money(snapshot.income)}</strong></div>
    </div>
<section className="card dashboard-plan-summary" aria-labelledby="dashboard-plans-title"><h2 id="dashboard-plans-title">Socios por plan</h2>
        <p className="muted">Plan más reciente de cada socio.</p>
        <ul className="dashboard-breakdown">
          {snapshot.plans.map(item => <li key={item.name}><span>{item.name}</span><strong>{item.count}</strong><meter min={0} max={Math.max(1,snapshot.members)} value={item.count} aria-label={`${item.name}: ${item.count} socios`}/></li>)}
          {snapshot.withoutPlan>0&&<li><span>Sin plan</span><strong>{snapshot.withoutPlan}</strong><meter min={0} max={Math.max(1,snapshot.members)} value={snapshot.withoutPlan} aria-label="Socios sin plan"/></li>}
        </ul>
      </section>

</details></div></>}
  </section>
}
