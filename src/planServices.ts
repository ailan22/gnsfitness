import { parseDay } from './membership'

export const NUTRITION_PRICE = 3000
export const PHYSIO_SESSION_PRICE = 650

export type PlanServiceConfig = { version: 1; nutritionMonthly: number; nutritionMonths: number; physioSessionPrice: number; physioDates: string[]; physioTimes?: Record<string, string> }

export function planTotal(base: number, months: number, nutrition: boolean, physioDates: string[]) {
  return base + (nutrition ? NUTRITION_PRICE * months : 0) + new Set(physioDates).size * PHYSIO_SESSION_PRICE
}

export function scheduledForDay(config: PlanServiceConfig | null | undefined, date: string): boolean {
  return config?.version === 1 && Array.isArray(config.physioDates) && config.physioDates.includes(date)
}

export function serviceDates(month: string, weekdays: number[], start: string, end: string, weeks = [1, 2, 3, 4, 5]): string[] {
  if (!/^\d{4}-\d{2}$/.test(month) || !parseDay(`${month}-01`) || !parseDay(start) || !parseDay(end)) return []
  const dates: string[] = []
  for (let day = 1; day <= 31; day++) {
    const value = `${month}-${String(day).padStart(2, '0')}`
    const date = parseDay(value)
    if (date && value >= start && value <= end && weekdays.includes(date.getUTCDay()) && weeks.includes(Math.ceil(day / 7))) dates.push(value)
  }
  return dates
}

export function summarizeServiceDates(dates: string[]): string {
  const grouped = new Map<string, number[]>()
  for (const date of [...new Set(dates)].sort()) {
    if (!parseDay(date)) continue
    const month = date.slice(0, 7)
    grouped.set(month, [...(grouped.get(month) ?? []), Number(date.slice(8))])
  }
  return [...grouped].map(([month, days]) => {
    const ranges: string[] = []
    for (let i = 0; i < days.length; i++) {
      const first = days[i]
      while (i + 1 < days.length && days[i + 1] === days[i] + 1) i++
      ranges.push(first === days[i] ? `${first}` : `${first}–${days[i]}`)
    }
    return `${month.slice(5)}/${month.slice(0, 4)}: ${ranges.join(', ')}`
  }).join('; ')
}
