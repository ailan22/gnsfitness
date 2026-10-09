import { useRef, useState, type ReactNode } from 'react'

const sections = [
  ['plans', 'Plan y pagos'], ['personal', 'Datos personales'],
  ['health', 'Anamnesis'], ['access', 'Acceso al panel'],
  ['account', 'Gestión de la cuenta'], ['results', 'Resultados del programa'],
  ['training', 'Entrenamiento y rutinas'],
] as const

export default function MemberWorkspace({ name, children }: { name: string; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState('plans')
  function navigate(section: string) {
    const target = content.current?.querySelector<HTMLElement>(`[data-member-section="${section}"]`)
    if (!target) return
    const details = target.matches('details') ? target as HTMLDetailsElement : target.querySelector('details')
    if (details) details.open = true
    setCurrent(section)
    target.scrollIntoView({ block: 'start', behavior: 'auto' })
    target.focus({ preventScroll: true })
  }
  return <>
    <div className="member-workspace">
      <aside className="member-workspace-sidebar">
        <div className="member-workspace-identity"><span className="member-initials" aria-hidden="true">{name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span><h2>{name}</h2></div>
        <nav aria-label="Secciones de la ficha">{sections.map(([key, label]) => <button type="button" key={key} aria-current={current === key ? 'location' : undefined} onClick={() => navigate(key)}>{label}<span aria-hidden="true">›</span></button>)}</nav>
      </aside>
      <div className="member-workspace-content" ref={content}>{children}</div>
    </div>
    <p className="member-workspace-signature">GYM NATURE SOUL</p>
  </>
}
