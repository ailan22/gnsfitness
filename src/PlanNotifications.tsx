import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'
import { planReminders, uruguayToday, type ReminderPlan } from './planReminders'

type Person = { id: string; first_name: string; last_name: string; status: string }
export default function PlanNotifications({ client, memberId, revision = 0, onOpen }: { client: SupabaseClient; memberId?: string; revision?: number; onOpen?: (id: string) => void }) {
  const [snapshot, setSnapshot] = useState<{ plans: ReminderPlan[]; people: Person[]; date: string } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true, busy = false
    const refresh = async () => {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        const [plans, people] = await Promise.all([
          readAllPages((from, to) => { let q = client.from('memberships').select('id,member_id,starts_at,ends_at,service_config', { count: 'exact' }); if (memberId) q = q.eq('member_id', memberId); return q.order('id').range(from, to) }),
          readAllPages((from, to) => { let q = client.from('members').select('id,first_name,last_name,status', { count: 'exact' }); if (memberId) q = q.eq('id', memberId); return q.order('id').range(from, to) }),
        ])
        if (plans.error || people.error) throw new Error('read')
        if (active) { setSnapshot({ plans: plans.data as ReminderPlan[], people: people.data as Person[], date: uruguayToday() }); setFailed(false) }
      } catch { if (active) { setSnapshot(null); setFailed(true) } }
      finally { busy = false }
    }
    const start = setTimeout(() => void refresh(), 0)
    const timer = setInterval(() => void refresh(), 60_000)
    const focus = () => void refresh()
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus)
    return () => { active = false; clearTimeout(start); clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus) }
  }, [client, memberId, revision])
  const people = new Map(snapshot?.people.filter(p => p.status === 'Activo').map(p => [p.id, p]))
  const notices = snapshot ? planReminders(snapshot.plans, snapshot.date).filter(n => people.has(n.memberId)) : []
  return <div className="plan-notification-corner"><details className="plan-notifications">
    <summary aria-label="Avisos" title="Abrir avisos"><span className="plan-notification-label">Avisos</span> <span className="badge" role="status">{failed ? '!' : snapshot ? notices.length : '…'}</span></summary>
    <div className="plan-notification-list">
      {failed ? <p role="alert">No se pudieron actualizar los avisos. Revisá tu conexión.</p> : !snapshot ? <p>Cargando avisos…</p> : !notices.length ? <p>No hay avisos próximos.</p> : notices.map(n => <article key={n.key}>
        {!memberId && <strong>{people.get(n.memberId)?.first_name} {people.get(n.memberId)?.last_name}</strong>}
        <p>{n.kind === 'physio' ? 'Sesión de kinesiología' : 'Vencimiento del plan'} · {n.days === 0 ? 'hoy' : n.days === 1 ? 'mañana' : `en ${n.days} días`}</p>
        <small>{n.date.split('-').reverse().join('/')}</small>
        {memberId && n.kind === 'expiry' && <p>Hola, {people.get(n.memberId)?.first_name}. {n.days>5?'Te avisamos con tiempo para que puedas organizar tu próxima renovación.':'Te recordamos que se acerca la renovación de tu plan.'} Podés coordinarla con el equipo de GNS FITNESS. Si ya realizaste el pago y aún no figura, avisanos para revisarlo. ¡Gracias por entrenar con nosotros!</p>}
        {onOpen && <button type="button" className="text-button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onOpen(n.memberId) }}>Ver ficha</button>}
      </article>)}
      <small>Sesiones: desde 2 días antes. Planes: aviso a los 10 días y recordatorio a los 5; quedan visibles hasta el vencimiento. Se actualizan mientras usás la app.</small>
    </div>
  </details></div>
}
