import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { healthFields, healthTitles, type HealthRecord } from './healthRecords'

export default function HealthPrint({ name, memberId, records, superseded, onClose }: {
  name: string; memberId: string; records: HealthRecord[]; superseded: Set<string>; onClose: () => void
}) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    document.body.classList.add('printing-health')
    close.current?.focus()
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => { document.body.classList.remove('printing-health'); window.removeEventListener('keydown', key); previous?.focus() }
  }, [onClose])
  return createPortal(<div className="clinical-print-overlay" role="dialog" aria-modal="true" aria-label="Vista de impresión de ficha privada">
    <div className="clinical-print-actions"><button type="button" onClick={() => window.print()}>Imprimir</button><button type="button" ref={close} onClick={onClose}>Cerrar vista de impresión</button><p>Solo registros guardados. Revisá el destino de impresión.</p></div>
    <main className="clinical-print-sheet"><header><h1>GNS FITNESS</h1><h2>{name}</h2><p>Ficha: {memberId} · Impreso: {new Date().toLocaleDateString('es-UY')}</p><p>Información confidencial · Uso profesional</p></header>
      {records.map(row => <article key={row.id}><h2>{healthTitles[row.kind]}</h2>
        <p><strong>Fecha:</strong> {row.occurred_on.split('-').reverse().join('/')} · <strong>Profesional:</strong> {row.professional}{row.registration && ` · Registro: ${row.registration}`}</p>
        <p>Registro: {row.id}{row.episode_id && ` · Evaluación vinculada: ${row.episode_id}`}</p>
        {superseded.has(row.id) && <p><strong>Rectificado: se conserva como antecedente, no es la versión vigente.</strong></p>}
        {row.correction_of && <p>Rectifica: {row.correction_of} · Motivo: {row.correction_reason}</p>}
        <dl>{healthFields[row.kind].filter(field => row.payload[field.key]?.trim()).map(field => <div key={field.key}><dt>{field.label}</dt><dd>{row.payload[field.key]}</dd></div>)}</dl>
      </article>)}
    </main>
  </div>, document.body)
}
