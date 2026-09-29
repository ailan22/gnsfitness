// Server-side selection only. This module does not send messages or change data.
// The caller must fetch complete lists and recheck eligibility before sending.
const DAY = 86_400_000
function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Fecha inválida')
  const time = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Fecha inválida')
  return time
}

export function dayInUruguay(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function selectReminders({ members, memberships, contacts, blockedKeys = [], today = dayInUruguay() }) {
  const current = dateValue(today)
  const target = new Date(current + 5 * DAY).toISOString().slice(0, 10)
  const blocked = new Set(blockedKeys)
  const contactByMember = new Map(contacts.map(contact => [contact.member_id, contact]))
  const plansByMember = new Map()
  for (const plan of memberships) {
    if (!plan.id || !plan.member_id || dateValue(plan.ends_at) < dateValue(plan.starts_at)) throw new Error('Plan inválido')
    const plans = plansByMember.get(plan.member_id) ?? []
    plans.push(plan)
    plansByMember.set(plan.member_id, plans)
  }
  const reminders = []
  for (const member of members) {
    if (member.status !== 'Activo') continue
    const contact = contactByMember.get(member.id)
    // Consent is tied to this exact phone number, not inferred from an existing member.
    if (!contact?.whatsapp_opt_in_at || contact.whatsapp_opt_out_at || !/^\+[1-9]\d{7,14}$/.test(contact.phone_e164 ?? '')) continue
    const plans = plansByMember.get(member.id) ?? []
    // Longest currently valid coverage wins when memberships overlap.
    const active = plans.filter(plan => plan.starts_at <= today && plan.ends_at >= today)
      .sort((a, b) => b.ends_at.localeCompare(a.ends_at) || b.starts_at.localeCompare(a.starts_at) || String(a.id).localeCompare(String(b.id)))[0]
    if (!active || active.ends_at !== target) continue
    const followingDay = new Date(dateValue(active.ends_at) + DAY).toISOString().slice(0, 10)
    // An already recorded renewal covering the next day makes this notice unnecessary.
    if (plans.some(plan => plan.id !== active.id && plan.starts_at <= followingDay && plan.ends_at > active.ends_at)) continue
    const key = `whatsapp:${member.id}:${active.id}:${active.ends_at}:five-days`
    if (blocked.has(key)) continue
    reminders.push({ key, member_id: member.id, membership_id: active.id,
      first_name: member.first_name, phone_e164: contact.phone_e164, expires_on: active.ends_at, notify_on: today })
    blocked.add(key)
  }
  return reminders
}
