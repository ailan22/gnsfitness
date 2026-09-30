import { lazy, Suspense, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
const CloudHealth = lazy(() => import('./CloudHealth'))

export default function MemberHealthSections({ client, memberId, onDirtyChange }: {
  client: SupabaseClient; memberId: string; onDirtyChange: (dirty: boolean) => void
}) {
  const [intakeDirty, setIntakeDirty] = useState(false)
  const [physioDirty, setPhysioDirty] = useState(false)
  const [opened, setOpened] = useState({ intake: false, physio: false })
  useEffect(() => {
    onDirtyChange(intakeDirty || physioDirty)
    return () => onDirtyChange(false)
  }, [intakeDirty, physioDirty, onDirtyChange])
  return <div className="member-health-sections">{(['intake', 'physio'] as const).map(mode => <details className="intake-accordion" key={mode}
    onToggle={event => { if (event.currentTarget.open) setOpened(current => ({ ...current, [mode]: true })) }}>
    <summary><span><strong>{mode === 'intake' ? 'Anamnesis inicial de salud y entrenamiento' : 'Kinesiología'}</strong><small>Ficha privada · desplegar para consultar y registrar</small></span></summary>
    {opened[mode] && <Suspense fallback={<p role="status">Cargando ficha privada…</p>}><CloudHealth client={client} mode={mode} initialMemberId={memberId} embedded onDirtyChange={mode === 'intake' ? setIntakeDirty : setPhysioDirty}/></Suspense>}
  </details>)}</div>
}
