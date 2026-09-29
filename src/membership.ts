const DAY = 86_400_000

export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date : null
}

export function membershipEnd(start: string, months: number): string | null {
  const first = parseDay(start)
  if (!first || !Number.isInteger(months) || months < 1 || months > 12) return null
  const year = first.getUTCFullYear()
  const month = first.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const clamped = first.getUTCDate() > lastDay
  const anniversary = new Date(Date.UTC(year, month, Math.min(first.getUTCDate(), lastDay)))
  return new Date(anniversary.getTime() - (clamped ? 0 : DAY)).toISOString().slice(0, 10)
}

export function daysUntil(end: string, today: string): number | null {
  const expiry = parseDay(end)
  const current = parseDay(today)
  return expiry && current ? Math.round((expiry.getTime() - current.getTime()) / DAY) : null
}
