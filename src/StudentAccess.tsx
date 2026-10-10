import MemberSectionTitle from './MemberSectionTitle'
import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

export default function StudentAccess({ client, member }: { client: SupabaseClient; member: { id: string; email: string; status: string } }) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  const email = member.email.trim()
  async function invite() {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage(''); setError('')
    try {
      const { data, error: failure } = await client.functions.invoke('invite-student', { body: { member_id: member.id } })
      if (failure) {
        let detail = 'No se pudo confirmar el envío. Si es la primera vez, falta activar el servicio de invitaciones en Supabase.'
        if (failure.context instanceof Response) {
          try { const body = await failure.context.json(); if (typeof body.error === 'string') detail = body.error } catch { /* Preserve the safe fallback. */ }
        }
        setError(detail); return
      }
      if (!data?.ok) { setError('El servicio no confirmó la operación. Actualizá la ficha antes de reintentar.'); return }
      setMessage(data.message); setConfirming(false)
    } catch { setError('Se interrumpió la conexión. El correo puede haberse enviado; esperá un minuto antes de reintentar.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <details className="member-compact" aria-label="Acceso del alumno">
    <summary><MemberSectionTitle kind="access">Acceso del alumno</MemberSectionTitle></summary>
    <div className="member-section-content">
    <p>El socio recibe un correo para establecer su contraseña y entrar a sus rutinas. Si ya tiene cuenta, se le envía un enlace para restablecerla.</p>
    <p><strong>Correo de la ficha:</strong> {email || 'Sin correo. Editá la ficha para agregarlo.'}</p>
    {!Capacitor.isNativePlatform() && window.location.hostname === 'localhost' && <p className="notice">Estás usando la versión local de prueba. Comprobá la dirección de destino antes de enviar invitaciones.</p>}
    {member.status !== 'Activo' && <p>El socio debe estar activo para habilitar su acceso.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!confirming ? <button type="button" disabled={!email || member.status !== 'Activo'} onClick={() => { setConfirming(true); setError(''); setMessage('') }}>Habilitar acceso / reenviar correo</button> : <>
      <p>Confirmá que <strong>{email}</strong> pertenece a este socio. Se enviará el enlace a esa dirección.</p>
      <div className="actions"><button type="button" disabled={busy} onClick={() => void invite()}>{busy ? 'Procesando…' : 'Confirmar y enviar correo'}</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</button></div>
    </>}
    </div>
  </details>
}
