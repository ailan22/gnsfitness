import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'

const labels = { access: 'Acceso a mis datos', correction: 'Rectificar mis datos', deletion: 'Eliminar mi cuenta y mis datos' }
type Request = { id: string; user_id: string | null; kind: keyof typeof labels; status: string; created_at: string; resolution: string }
export default function AccountPrivacy({ client, admin = false }: { client: SupabaseClient; admin?: boolean }) {
  const [rows, setRows] = useState<Request[]>([])
  const [contacts, setContacts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const refresh = useCallback(async () => {
    try {
      const result = await readAllPages((a, b) => client.from('privacy_requests').select('id,user_id,kind,status,created_at,resolution', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range(a, b))
      if (result.error) throw result.error
      if (admin) {
        const members = await readAllPages((a, b) => client.from('members').select('id,user_id,first_name,last_name,email', { count: 'exact' }).order('id').range(a, b))
        if (members.error) throw members.error
        setContacts(Object.fromEntries((members.data ?? []).filter(m => m.user_id).map(m => [m.user_id, `${m.first_name} ${m.last_name} · ${m.email}`])))
      }
      setRows(result.data as Request[]); setError('')
    } catch { setError('No se pudieron consultar las solicitudes. Actualizá para reintentar.') }
    finally { setLoading(false) }
  }, [client, admin])
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0)
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 30000)
    window.addEventListener('focus', refresh)
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [refresh])
  async function request(kind: keyof typeof labels) {
    if (busy || !window.confirm(kind === 'deletion'
      ? '¿Solicitar la eliminación definitiva de tu cuenta y tus datos? La administración la tramitará y te responderá en hasta 5 días hábiles. Te informará si debe conservar algún registro por una obligación legal. Esto no cancela por sí solo servicios contratados con el gimnasio.'
      : `¿Enviar la solicitud «${labels[kind]}» a la administración?`)) return
    setBusy(true); setMessage('')
    try {
      const result = await client.rpc('request_privacy_action', { p_kind: kind })
      if (result.error) throw result.error
      setMessage('Solicitud recibida. Te responderemos al correo de tu cuenta en hasta 5 días hábiles.'); await refresh()
    } catch { setError('No se pudo confirmar el envío. Actualizá antes de reintentar; no se duplican solicitudes pendientes.') }
    finally { setBusy(false) }
  }
  async function complete(row: Request) {
    const resolution = window.prompt('Registrá la respuesta ya enviada al titular y las actuaciones realizadas. No incluyas información clínica. Marcar como atendida NO elimina la cuenta ni los datos por sí solo.')
    if (!resolution || busy) return
    if (resolution.trim().length < 10 || resolution.length > 2000) { setError('Ingresá una respuesta de 10 a 2000 caracteres.'); return }
    setBusy(true)
    try { const result = await client.rpc('complete_privacy_request', { p_id: row.id, p_resolution: resolution }); if (result.error) throw result.error; await refresh() }
    catch { setError('No se pudo cerrar la solicitud. Actualizá para verificar el estado.') }
    finally { setBusy(false) }
  }
  const pending = rows.filter(r => r.status === 'pending')
  return <details className="card account-privacy"><summary>{admin ? `Solicitudes sobre datos personales${pending.length ? ` · ${pending.length} pendientes` : ''}` : 'Mi cuenta y mis datos'}</summary>
    <p className="muted">{admin ? 'Responder al titular en hasta 5 días hábiles. Realizá las acciones necesarias antes de marcar una solicitud como atendida. Este botón no borra registros.' : 'Podés solicitar acceso, rectificación o eliminación definitiva. La administración gestiona tu solicitud y confirma el resultado por correo. No envíes datos de salud por email.'}</p>
    {error && <p className="error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button className="secondary" type="button" disabled={busy} onClick={() => void refresh()}>Actualizar solicitudes</button>
    {!admin && <div className="actions">{(Object.keys(labels) as (keyof typeof labels)[]).map(kind => <button type="button" className="secondary" key={kind} disabled={busy || loading || pending.some(r => r.kind === kind)} onClick={() => void request(kind)}>{labels[kind]}</button>)}</div>}
    {loading ? <p>Cargando…</p> : (admin ? pending : rows).map(row => <article key={row.id} className="student-feedback-item"><strong>{labels[row.kind]}</strong><p>{row.created_at.slice(0, 10)} · {row.status === 'pending' ? 'Pendiente' : 'Atendida'}</p>{admin && <p>{contacts[row.user_id ?? ''] ?? `Cuenta ${row.user_id ?? 'eliminada'}`}</p>}{row.resolution && <p>{row.resolution}</p>}{admin && <button type="button" disabled={busy} className="secondary" onClick={() => void complete(row)}>Registrar atención realizada</button>}</article>)}
    {!loading && !rows.length && <p>No hay solicitudes.</p>}
  </details>
}
