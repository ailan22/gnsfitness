import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export default function DeleteStudentAccount({ client, memberId, name, onDeleted }: { client: SupabaseClient; memberId: string; name: string; onDeleted: () => void }) {
  const [target, setTarget] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const pending = useRef(false)
  async function prepare() {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage('')
    try {
      const result = await client.from('members').select('user_id').eq('id', memberId).single()
      if (result.error) throw result.error
      if (!result.data.user_id) { setMessage('Esta ficha no tiene una cuenta vinculada.'); return }
      setTarget(result.data.user_id); setConfirmation('')
    } catch { setMessage('No se pudo verificar la cuenta. Volvé a intentarlo.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function remove() {
    if (pending.current || !target || confirmation !== 'ELIMINAR') return
    pending.current = true; setBusy(true); setMessage('')
    try {
      const result = await client.rpc('delete_student_account', { p_member_id: memberId, p_expected_user_id: target })
      if (result.error || typeof result.data !== 'boolean') throw result.error ?? new Error('Sin confirmación')
      setTarget(null); setConfirmation(''); setMessage('La ficha ya no tiene cuenta de acceso. Se conserva el historial.'); onDeleted()
    } catch { setMessage('No se pudo confirmar la eliminación. Reintentá para verificarla; no se eliminará otra cuenta si cambió el acceso.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <details className="member-compact"><summary>Eliminar cuenta</summary>
    <p>Elimina el acceso de {name} y lo deja de baja. Conserva su ficha, pagos, rutinas e historia de atención.</p>
    {message && <p role="status">{message}</p>}
    {!target ? <button type="button" className="secondary" disabled={busy} onClick={() => void prepare()}>Eliminar cuenta del alumno</button> : <>
      <label>Escribí ELIMINAR para confirmar<input value={confirmation} disabled={busy} autoComplete="off" onChange={e => setConfirmation(e.target.value)}/></label>
      <div className="actions"><button type="button" disabled={busy || confirmation !== 'ELIMINAR'} onClick={() => void remove()}>{busy ? 'Eliminando…' : 'Confirmar eliminación'}</button><button type="button" className="secondary" disabled={busy} onClick={() => { setTarget(null); setConfirmation('') }}>Cancelar</button></div>
    </>}
  </details>
}
