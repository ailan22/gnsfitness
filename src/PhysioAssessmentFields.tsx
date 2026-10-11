import { useId } from 'react'
import { healthFields, type HealthDraft } from './healthRecords'
import './PhysioAssessmentFields.css'

function ChoiceDetail({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId()
  const [answer, ...description] = value.split('\nDetalle: ')
  const options = ['Sí', 'No refiere', 'Pendiente']
  if (value && !options.includes(answer)) return <label>{label}<textarea rows={3} maxLength={900} value={value} onChange={e => onChange(e.target.value)}/><small>Texto del registro anterior, conservado íntegramente.</small></label>
  return <fieldset className="physio-choice"><legend>{label}</legend><div className="physio-choice-options">{options.map(option => <label key={option}><input type="radio" name={id} checked={answer === option} onChange={() => onChange(option === 'Sí' && description.length ? `${option}\nDetalle: ${description.join('\nDetalle: ')}` : option)}/>{option}</label>)}</div>{answer === 'Sí' && <label>Especificar<textarea rows={2} required maxLength={900} value={description.join('\nDetalle: ')} onChange={e => onChange(`Sí\nDetalle: ${e.target.value}`)}/></label>}</fieldset>
}

export default function PhysioAssessmentFields({ draft, onChange }: { draft: HealthDraft; onChange: (draft: HealthDraft) => void }) {
  const update = (key: string, value: string) => onChange({ ...draft, payload: { ...draft.payload, [key]: value } })
  const medication = draft.payload.medication ?? ''
  const structured = !medication || /^Medicación: [\s\S]*\n\nAlergias: /.test(medication)
  const separator = medication.indexOf('\n\nAlergias: ')
  const medicine = structured && medication ? medication.slice(12, separator) : ''
  const allergies = structured && medication ? medication.slice(separator + 12) : ''
  const field = (key: string) => {
    const spec = healthFields.physio_assessment.find(item => item.key === key)!
    const value = draft.payload[key] ?? ''
    if (key === 'alert_details' && draft.payload.alerts !== 'Requiere derivación' && !value) return null
    return <label key={key} className={`physio-field physio-field-${key}`}>{spec.label}{spec.required && ' *'}{spec.options ? <select required={spec.required} value={value} onChange={e => update(key, e.target.value)}><option value="">Seleccionar</option>{spec.options.map(option => <option key={option}>{option}</option>)}</select> : spec.type ? <input type={spec.type === 'pain' ? 'number' : spec.type} min={spec.type === 'pain' ? 0 : undefined} max={spec.type === 'pain' ? 10 : undefined} step={spec.type === 'pain' ? 1 : undefined} required={spec.required} maxLength={2000} value={value} onChange={e => update(key, e.target.value)}/> : <textarea rows={2} required={spec.required} maxLength={2000} value={value} onChange={e => update(key, e.target.value)}/>} {spec.hint && <small className="muted">{spec.hint}</small>}</label>
  }
  return <div className="physio-assessment">
    <div className="physio-consultation"><section><h3>Consulta inicial</h3>{['reason', 'region', 'onset'].map(field)}</section><section><h3>Dolor y función</h3><div className="physio-pain">{['pain_rest', 'pain_movement'].map(field)}</div>{['factors', 'function'].map(field)}</section></div>
    <details className="physio-section"><summary><span className="physio-number">01</span>Antecedentes, medicación y alergias</summary><div className="physio-section-content physio-two-columns"><section><h3>Antecedentes relevantes</h3><HistoryChoices value={draft.payload.history ?? ''} onChange={value => update('history', value)}/></section><section><h3>Medicación y alergias</h3>{structured ? <><ChoiceDetail label="¿Toma medicación?" value={medicine} onChange={value => update('medication', `Medicación: ${value}\n\nAlergias: ${allergies}`)}/><ChoiceDetail label="¿Refiere alergias?" value={allergies} onChange={value => update('medication', `Medicación: ${medicine}\n\nAlergias: ${value}`)}/></> : field('medication')}</section></div></details>
    <details className="physio-section"><summary><span className="physio-number">02</span>Derivación, estudios y señales de alarma</summary><div className="physio-section-content">{['referral', 'alerts', 'alert_details'].map(field)}</div></details>
    <details className="physio-section"><summary><span className="physio-number">03</span>Exploración y valoración funcional</summary><div className="physio-section-content physio-two-columns">{['examination', 'assessment'].map(field)}</div></details>
    <details className="physio-section"><summary><span className="physio-number">04</span>Objetivos, plan y consentimiento</summary><div className="physio-section-content physio-two-columns">{['goals', 'plan', 'review_date', 'consent', 'consent_notes'].map(field)}</div></details>
  </div>
}

function HistoryChoices({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = ['Lesiones previas', 'Cirugías', 'Enfermedades', 'Otros', 'No refiere', 'Pendiente']
  const [answer, ...parts] = value.split('\nDetalle: ')
  const selected = answer ? answer.split(' · ') : []
  const description = parts.join('\nDetalle: ')
  if (selected.some(item => !options.includes(item))) return <label>Antecedentes y tratamientos previos<textarea rows={4} maxLength={2000} value={value} onChange={e => onChange(e.target.value)}/><small>Se conserva el texto del registro anterior.</small></label>
  const needsDetail = selected.some(item => options.slice(0, 4).includes(item))
  return <><div className="physio-history-options">{options.map(option => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={e => {
    const next = !e.target.checked ? selected.filter(item => item !== option) : options.slice(4).includes(option) ? [option] : [...selected.filter(item => !options.slice(4).includes(item)), option]
    onChange(`${next.join(' · ')}${next.some(item => options.slice(0, 4).includes(item)) && description ? `\nDetalle: ${description}` : ''}`)
  }}/>{option}</label>)}</div>{needsDetail && <label>Detalle relevante y tratamientos previos<textarea rows={4} required maxLength={1800} value={description} onChange={e => onChange(`${selected.join(' · ')}\nDetalle: ${e.target.value}`)}/></label>}</>
}
