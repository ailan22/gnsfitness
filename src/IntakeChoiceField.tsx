import { useId } from 'react'

import { intakeChoices } from './intakeChoices'

// Store readable text in the existing clinical field, retaining compatibility
// with saved records, the database validator and the iPhone version in review.
export default function IntakeChoiceField({ fieldKey, label, required, value, onChange }: {
  fieldKey: string; label: string; required?: boolean; value: string; onChange: (value: string) => void
}) {
  const name = useId()
  const config = intakeChoices[fieldKey]
  const [answer, ...detailParts] = value.split('\nDetalle: ')
  const selected = answer ? answer.split(' · ') : []
  const legacy = selected.some(item => !config.options.includes(item))
  const detail = detailParts.join('\nDetalle: ')
  const showDetail = selected.some(item => config.detailFor?.includes(item)) || Boolean(detail)
  const write = (next: string[]) => onChange(next.join(' · ') + (detail ? `\nDetalle: ${detail}` : ''))
  return <fieldset className="intake-choice health-wide"><legend>{label}{required ? ' *' : ''}</legend>
    {legacy ? <><p className="muted">Texto de una ficha anterior. Se conserva para su revisión.</p><textarea required={required} maxLength={2000} value={value} onChange={e => onChange(e.target.value)}/></> : <>
      <div className="intake-choice-options">{config.options.map(option => <label key={option}>
        <input type={config.multiple ? 'checkbox' : 'radio'} name={name} checked={selected.includes(option)} required={required && (!config.multiple || selected.length === 0)} onChange={e => write(config.multiple ? e.target.checked ? [...selected, option] : selected.filter(item => item !== option) : [option])}/>{option}
      </label>)}</div>
      {showDetail && <label>Detalle relevante<textarea rows={2} maxLength={Math.max(0, 1990 - answer.length)} required={selected.some(item => config.detailFor?.includes(item))} value={detail} onChange={e => onChange(answer + (e.target.value ? `\nDetalle: ${e.target.value}` : ''))}/></label>}
    </>}
  </fieldset>
}
