export const SESSION_MINUTES = 35
export type RoomAppointment = { id: string; member_id: string; membership_id: string | null; kind: 'physio' | 'reiki' | 'akashic'; session_date: string; starts_at: string; ends_at: string; cancelled: boolean }
export function availableRoomTimes(date: string, appointments: RoomAppointment[], membershipId?: string): string[] {
  const occupied = appointments.filter(a => !a.cancelled && a.session_date === date && (!membershipId || a.membership_id !== membershipId))
  const choices: string[] = []
  for (let minute = 0; minute + SESSION_MINUTES < 1440; minute += 5) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
    const start = Date.parse(`${date}T${time}:00-03:00`), end = start + SESSION_MINUTES * 60_000
    if (Number.isFinite(start) && !occupied.some(a => start < Date.parse(a.ends_at) && end > Date.parse(a.starts_at))) choices.push(time)
  }
  return choices
}
export const roomTime = (value: string) => new Intl.DateTimeFormat('es-UY', { timeZone:'America/Montevideo', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(value))
