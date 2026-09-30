import { healthFields, todayHealth, type HealthKind, type HealthDraft } from './healthRecords'
export default function HealthFormFields({ kind, draft, onChange }: { kind: HealthKind; draft: HealthDraft; onChange: (draft: HealthDraft) => void }) {
  const groups = [...new Set(healthFields[kind].map(field => field.group))]
  return <div className="health-fields">
    <p className="muted">Los campos con * son obligatorios. Los demás se completan solo si son relevantes; un campo vacío significa «sin registrar».</p>
    <div className="grid">
      <label>Fecha de atención *<input type="date" required min="1900-01-01" max={todayHealth()} value={draft.occurred_on} onChange={e => onChange({ ...draft, occurred_on: e.target.value })}/></label>
      <label>Profesional responsable *<input required maxLength={160} autoComplete="off" value={draft.professional} onChange={e => onChange({ ...draft, professional: e.target.value })}/></label>
      {kind !== 'training_intake' && <label>Registro profesional / habilitación<input maxLength={100} value={draft.registration} onChange={e => onChange({ ...draft, registration: e.target.value })}/></label>}
    </div>
    {groups.map((group, index) => <fieldset key={group} className="health-group"><legend><span>{String(index + 1).padStart(2, '0')}</span> {group}</legend>
      <div className="health-field-grid">{healthFields[kind].filter(field => field.group === group).map(field => {
        const value = draft.payload[field.key] ?? ''
        if (field.key === 'symptom_details' && draft.payload.symptoms !== 'Síntomas referidos' && !value) return null
        if (field.key === 'alert_details' && draft.payload.alerts !== 'Requiere derivación' && !value) return null
        const update = (next: string) => onChange({ ...draft, payload: { ...draft.payload, [field.key]: next } })
        return <label key={field.key} className={field.type || field.options ? '' : 'health-wide'}>{field.label}{field.required ? ' *' : ''}
          {field.options ? <select required={field.required} value={value} onChange={e => update(e.target.value)}><option value="">Seleccionar…</option>{field.options.map(option => <option key={option}>{option}</option>)}</select>
            : field.type ? <input type={field.type === 'pain' ? 'number' : field.type} min={field.type === 'pain' ? 0 : undefined} max={field.type === 'pain' ? 10 : undefined} step={field.type === 'pain' ? 1 : undefined} maxLength={2000} required={field.required} value={value} onChange={e => update(e.target.value)}/>
              : <textarea rows={3} maxLength={2000} required={field.required} value={value} onChange={e => update(e.target.value)}/>}
          {field.hint && <small className="muted">{field.hint}</small>}
        </label>
      })}</div>
    </fieldset>)}
    <p className="health-private">Acceso privado del administrador. La valoración y las decisiones corresponden al profesional; el sistema no emite diagnósticos ni certificados de aptitud.</p>
  </div>
}
