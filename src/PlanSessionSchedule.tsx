import { useState } from 'react'
import { serviceDates, summarizeServiceDates } from './planServices'

export default function PlanSessionSchedule({ start, end, dates, onChange }: { start: string; end: string; dates: string[]; onChange: (dates: string[]) => void }) {
  const [month, setMonth] = useState(start.slice(0, 7))
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [weeks, setWeeks] = useState([1, 2, 3, 4, 5])
  const activeMonth = month >= start.slice(0, 7) && month <= end.slice(0, 7) ? month : start.slice(0, 7)
  const days = serviceDates(activeMonth, [0, 1, 2, 3, 4, 5, 6], start, end)
  const toggle = (items: number[], value: number) => items.includes(value) ? items.filter(item => item !== value) : [...items, value]
  return <details className="member-compact service-schedule"><summary>Programar sesiones · {dates.length} seleccionadas</summary>
    <label>Mes de las sesiones<input type="month" required value={activeMonth} min={start.slice(0, 7)} max={end.slice(0, 7)} onChange={e => setMonth(e.target.value)}/></label>
    <fieldset className="plain-fieldset"><legend>Días de la semana</legend><div className="schedule-options">{[['Lunes',1],['Martes',2],['Miércoles',3],['Jueves',4],['Viernes',5],['Sábado',6],['Domingo',0]].map(([name, n]) => <label key={n}><input type="checkbox" checked={weekdays.includes(Number(n))} onChange={() => setWeekdays(toggle(weekdays, Number(n)))}/>{name}</label>)}</div></fieldset>
    <fieldset className="plain-fieldset"><legend>Semanas del mes</legend><p className="muted">1: días 1–7 · 2: 8–14 · 3: 15–21 · 4: 22–28 · 5: 29–31.</p><div className="schedule-options">{[1,2,3,4,5].map(n => <label key={n}><input type="checkbox" checked={weeks.includes(n)} onChange={() => setWeeks(toggle(weeks, n))}/>Semana {n}</label>)}</div></fieldset>
    <button type="button" className="secondary" disabled={!weekdays.length || !weeks.length} onClick={() => onChange([...new Set([...dates, ...serviceDates(activeMonth, weekdays, start, end, weeks)])].sort())}>Agregar fechas de este mes</button>
    <p>Podés marcar o desmarcar cada fecha. Cada fecha cuenta como una sesión de $650.</p>
    <div className="schedule-calendar">{days.map(date => <label key={date}><input type="checkbox" checked={dates.includes(date)} onChange={() => onChange(dates.includes(date) ? dates.filter(d => d !== date) : [...dates, date].sort())}/>{date.slice(8)}</label>)}</div>
    <p className="muted">Fechas seleccionadas: {summarizeServiceDates(dates) || 'Ninguna'}</p>
    {dates.length > 0 && <button type="button" className="text-button" onClick={() => onChange([])}>Quitar todas las fechas</button>}
    <p className="muted">Al guardar, estas sesiones aparecerán como recordatorios en el panel administrativo el día correspondiente. No se envían mensajes al alumno.</p>
  </details>
}
