import { lazy, Suspense, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
const CloudHealth = lazy(() => import('./CloudHealth'))

export default function MemberHealthSections({ client, memberId, onDirtyChange }: {
  client: SupabaseClient; memberId: string; onDirtyChange: (dirty: boolean) => void
}) {
  const [intakeDirty, setIntakeDirty] = useState(false)
  const [opened, setOpened] = useState({ intake: false, physio: false })
  useEffect(() => {
    onDirtyChange(intakeDirty)
    return () => onDirtyChange(false)
  }, [intakeDirty, onDirtyChange])
  return <div className="member-health-sections">{(['intake'] as const).map(mode => <details className="intake-accordion" key={mode}
    onToggle={event => { if (event.currentTarget.open) setOpened(current => ({ ...current, [mode]: true })) }}>
    <summary><span><strong>Anamnesis</strong></span></summary>
    <div className="member-section-content">{opened[mode] && <Suspense fallback={<p role="status">Cargando ficha privada…</p>}><CloudHealth client={client} mode={mode} initialMemberId={memberId} embedded onDirtyChange={setIntakeDirty}/></Suspense>}</div>
  </details>)}</div>
}
