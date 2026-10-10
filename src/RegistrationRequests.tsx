import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Request = { user_id: string; first_name: string; last_name: string; email: string; phone: string; created_at: string }
export default function RegistrationRequests({ client, onChanged }: { client: SupabaseClient; onChanged: () => void }) {
  const [rows, setRows] = useState<Request[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const locked = useRef(false)
  const load = useCallback(async () => {
    try {
      const { data, count, error: failure } = await client.from('registration_requests').select('user_id,first_name,last_name,email,phone,created_at', { count: 'exact' }).eq('status','pending').order('created_at').order('user_id').range(page*20,page*20+19)
      if (failure) throw failure
      setRows(data ?? []); setTotal(count ?? 0); setError('')
      if (!data?.length && page > 0) setPage(value => value-1)
    } catch { setError('No se pudieron consultar las solicitudes. Intentá actualizar.'); setTotal(null) }
  }, [client, page])
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void load() })
    const check = () => { if (!document.hidden && !locked.current) void load() }
    const timer = window.setInterval(check,30000)
    window.addEventListener('focus',check)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus',check) }
  }, [load])
  async function decide(row: Request, approve: boolean) {
    if (locked.current || !window.confirm(approve
      ? `¿Habilitar a ${row.first_name} ${row.last_name} (${row.email})? Si ya tiene una ficha activa con ese correo, se vinculará a ella. Si no, se creará una ficha sin plan contratado.`
      : `¿Rechazar la solicitud de ${row.first_name} ${row.last_name}? No tendrá acceso al panel.`)) return
    locked.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const { error: failure } = await client.rpc('decide_registration', { p_user_id: row.user_id, p_approve: approve })
      if (failure) { setError(failure.code === 'P0001' ? failure.message : 'No se pudo resolver la solicitud. Verificá tu sesión de administrador y actualizá.'); return }
      setMessage(approve ? `Acceso habilitado para ${row.first_name}. Ya puede ingresar con su correo y contraseña.` : 'Solicitud rechazada.')
      onChanged(); await load()
    } catch { setError('La conexión se interrumpió. Actualizá la lista para comprobar el resultado antes de reintentar.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <details className="member-compact registration-requests"><summary>Solicitudes de registro <span className="badge">{total ?? '…'}</span></summary>
    <p>Revisá quién solicita acceso. Solo se habilita después de tu aprobación.</p>
    <button type="button" className="secondary" disabled={busy} onClick={() => void load()}>Actualizar solicitudes</button>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    {total === 0 && <p>No hay solicitudes pendientes.</p>}
    {rows.map(row => <article className="registration-request" key={row.user_id}>
      <h3>{row.first_name} {row.last_name}</h3><p>{row.email}</p>{row.phone && <p>Contacto: {row.phone}</p>}
      <div className="actions"><button type="button" disabled={busy} onClick={() => void decide(row,true)}>Aprobar y habilitar</button><button type="button" className="secondary" disabled={busy} onClick={() => void decide(row,false)}>Rechazar</button></div>
    </article>)}
    {(page > 0 || (total ?? 0)>20) && <div className="actions"><button type="button" disabled={busy || page===0} onClick={() => setPage(value=>value-1)}>Anterior</button><span>Página {page+1}</span><button type="button" disabled={busy || (page+1)*20 >= (total ?? 0)} onClick={() => setPage(value=>value+1)}>Siguiente</button></div>}
  </details>
}
