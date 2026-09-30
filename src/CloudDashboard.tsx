import { readAllPages } from './readAllPages'
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { daysUntil } from './membership'

type Member = { id: string; first_name: string; last_name: string; status: string; joined_at: string }
type Plan = { id: string; member_id: string; plan_name: string; starts_at: string; ends_at: string; price: number }
type Payment = { membership_id: string; paid_at: string; amount: number }
type Routine = { id: string }
type Session = { id: string; performed_at: string }
type Snapshot = { members: Member[]; plans: Plan[]; payments: Payment[]; routines: Routine[]; sessions: Session[] }

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
const money = (value: number) => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(value)
const cents = (value: number) => Math.round(Number(value) * 100)

export default function CloudDashboard({ client, revision, onOpenMembers }: { client: SupabaseClient; revision: number; onOpenMembers?: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshCount, setRefreshCount] = useState(0)
  const refresh = useCallback(async () => {
    setLoading(true)
    const [members, plans, payments, routines, sessions] = await Promise.all([
      readAllPages((from, to) => client.from('members').select('id,first_name,last_name,status,joined_at', { count: 'exact' }).order('id', { ascending: true }).range(from, to)),
      readAllPages((from, to) => client.from('memberships').select('id,member_id,plan_name,starts_at,ends_at,price', { count: 'exact' }).order('starts_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
      readAllPages((from, to) => client.from('payments').select('membership_id,paid_at,amount', { count: 'exact' }).order('id', { ascending: true }).range(from, to)),
      readAllPages((from, to) => client.from('routines').select('id', { count: 'exact' }).order('id', { ascending: true }).range(from, to)),
      readAllPages((from, to) => client.from('sessions').select('id,performed_at', { count: 'exact' }).order('id', { ascending: true }).range(from, to)),
    ])
    if ([members, plans, payments, routines, sessions].some(result => result.error)) {
      setSnapshot(null)
      setError('No se pudieron consultar todos los registros. No se muestran indicadores incompletos; intentá actualizar.')
    } else {
      setSnapshot({ members: members.data as Member[], plans: plans.data as Plan[], payments: payments.data as Payment[], routines: routines.data as Routine[], sessions: sessions.data as Session[] })
      setError('')
    }
    setLoading(false)
  }, [client])

  useEffect(() => {
    const timer = setTimeout(() => { void refresh() }, 0)
    const whenReturning = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', whenReturning)
    return () => { clearTimeout(timer); window.removeEventListener('focus', whenReturning) }
  }, [refresh, revision, refreshCount])

  const date = today()
  const month = date.slice(0, 7)
  const currentPlans = new Map<string, Plan>()
  for (const plan of snapshot?.plans ?? []) if (!currentPlans.has(plan.member_id)) currentPlans.set(plan.member_id, plan)
  const received = new Map<string, number>()
  for (const payment of snapshot?.payments ?? []) received.set(payment.membership_id, (received.get(payment.membership_id) ?? 0) + cents(payment.amount))
  const current = Array.from(currentPlans.values())
  const expired = current.filter(plan => { const days = daysUntil(plan.ends_at, date); return days !== null && days < 0 }).length
  const expiring = current.filter(plan => { const days = daysUntil(plan.ends_at, date); return days !== null && days >= 0 && days <= 10 }).length
  const pending = current.reduce((sum, plan) => sum + Math.max(0, cents(plan.price) - (received.get(plan.id) ?? 0)), 0)
  const debtors = current.filter(plan => cents(plan.price) > (received.get(plan.id) ?? 0)).length
  const planCounts = new Map<string, number>()
  for (const plan of current) planCounts.set(plan.plan_name, (planCounts.get(plan.plan_name) ?? 0) + 1)
  const pendingMembers = (snapshot?.members ?? []).flatMap(member => {
    const plan = currentPlans.get(member.id)
    if (!plan) return []
    const balance = Math.max(0, cents(plan.price) - (received.get(plan.id) ?? 0))
    return balance > 0 ? [{ member, plan, balance }] : []
  }).sort((a, b) => b.balance - a.balance || a.member.last_name.localeCompare(b.member.last_name, 'es'))
  const monthlyIncome = (snapshot?.payments ?? []).filter(item => item.paid_at.startsWith(month)).reduce((sum, item) => sum + cents(item.amount), 0)

  return <section className="cloud-dashboard" aria-label="Indicadores del gimnasio">
    <div className="heading"><div><p className="eyebrow">GNS FITNESS · VISIÓN GENERAL</p><h1>Panel de administración.</h1></div>
      <button type="button" className="secondary" onClick={() => setRefreshCount(value => value + 1)} disabled={loading}>Actualizar indicadores</button></div>
    <p className="muted">Socios, pagos y vencimientos.</p>
    {loading && !snapshot ? <p>Cargando indicadores…</p> : null}
    {error && <p role="alert" className="error">{error}</p>}
    {snapshot && <><div className="stats dashboard-primary">
      <div className="card"><span>Socios activos</span><strong>{snapshot.members.filter(member => member.status === 'Activo').length}</strong><small>{snapshot.members.length} personas registradas</small></div>
      <div className="card"><span>Ingresos del mes</span><strong className="amount">{money(monthlyIncome / 100)}</strong><small>Pagos registrados este mes</small></div>
      <div className="card"><span>Planes vencidos</span><strong className="red">{expired}</strong><small>{expiring} {expiring === 1 ? 'vence' : 'vencen'} en los próximos 10 días</small></div>
      <div className="card"><span>Saldo pendiente</span><strong className="amount">{money(pending / 100)}</strong><small>{debtors} {debtors === 1 ? 'persona' : 'personas'} con saldo</small></div>
    </div>
    <details className="additional-metrics"><summary>Más indicadores de actividad</summary><div className="stats">
      <div className="card"><span>Altas del mes</span><strong>{snapshot.members.filter(member => member.joined_at.startsWith(month)).length}</strong></div>
      <div className="card"><span>Bajas registradas</span><strong>{snapshot.members.filter(member => member.status === 'Baja').length}</strong></div>
      <div className="card"><span>Ingresos acumulados</span><strong className="amount">{money(snapshot.payments.reduce((sum, item) => sum + cents(item.amount), 0) / 100)}</strong></div>
      <div className="card"><span>Rutinas creadas</span><strong>{snapshot.routines.length}</strong></div>
      <div className="card"><span>Entrenamientos del mes</span><strong>{snapshot.sessions.filter(item => item.performed_at.startsWith(month)).length}</strong></div>
    </div></details>
    <div className="dashboard-details">
      <section className="card" aria-labelledby="dashboard-plans-title"><h2 id="dashboard-plans-title">Socios por plan</h2>
        <p className="muted">Plan más reciente de cada socio.</p>
        <ul className="dashboard-breakdown">
          {Array.from(planCounts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
            .map(item => <li key={item.name}><span>{item.name}</span><strong>{item.count}</strong></li>)}
          <li><span>Sin plan</span><strong>{snapshot.members.length - currentPlans.size}</strong></li>
        </ul>
      </section>
      <section className="card" aria-labelledby="dashboard-pending-title"><h2 id="dashboard-pending-title">Pagos pendientes</h2>
        <p className="muted">Saldo del plan más reciente. {debtors} socio{debtors === 1 ? '' : 's'} · {money(pending / 100)}.</p>
        {pendingMembers.length === 0 ? <p>Sin saldos pendientes.</p> : <ul className="dashboard-breakdown dashboard-pending-list">
          {pendingMembers.map(({ member, plan, balance }) => <li key={member.id}>
            <span><strong>{member.first_name} {member.last_name}</strong><small>{plan.plan_name}</small></span>
            <strong>{money(balance / 100)}</strong></li>)}
        </ul>}
      </section>
    </div><button type="button" className="text-button dashboard-members-link" onClick={onOpenMembers}>Ver personas y fichas →</button></>}
  </section>
}
