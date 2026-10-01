import { daysUntil, parseDay } from './membership'
import type { PlanServiceConfig } from './planServices'

export type ReminderPlan = { id: string; member_id: string; starts_at: string; ends_at: string; service_config?: PlanServiceConfig | null }
export type PlanNotice = { key: string; memberId: string; date: string; days: number; kind: 'physio' | 'expiry' }

export function uruguayToday(now = new Date()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

// Live reminders remain visible until their date; an already recorded renewal suppresses expiry.
export function planReminders(plans: ReminderPlan[], today: string): PlanNotice[] {
  if (!parseDay(today)) return []
  const valid = plans.filter(p => parseDay(p.starts_at) && parseDay(p.ends_at) && p.starts_at <= p.ends_at)
  const notices: PlanNotice[] = []
  for (const memberId of new Set(valid.map(p => p.member_id))) {
    const own = valid.filter(p => p.member_id === memberId)
    const active = own.filter(p => p.starts_at <= today && p.ends_at >= today).sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0]
    if (active) {
      const days = daysUntil(active.ends_at, today)!
      const renewed = own.some(p => p.ends_at > active.ends_at && (daysUntil(p.starts_at, active.ends_at) ?? Infinity) <= 1)
      if (days <= 5 && !renewed) notices.push({ key: `expiry:${active.id}:${active.ends_at}`, memberId, date: active.ends_at, days, kind: 'expiry' })
    }
    for (const plan of own) {
      if (plan.service_config?.version !== 1) continue
      for (const date of new Set(plan.service_config.physioDates ?? [])) {
        const days = daysUntil(date, today)
        if (days !== null && days >= 0 && days <= 2 && date >= plan.starts_at && date <= plan.ends_at)
          notices.push({ key: `physio:${plan.id}:${date}`, memberId, date, days, kind: 'physio' })
      }
    }
  }
  return notices.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))
}
