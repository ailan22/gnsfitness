import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'

const publicApp = 'https://still-disk-e7b3.gndevicciconde.workers.dev/'

export function CreateAccount({ client }: { client: SupabaseClient }) {
  const [form, setForm] = useState({ first: '', last: '', phone: '', email: '', password: '', repeat: '' })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked.current) return
    if (form.password.length < 12 || form.password !== form.repeat) { setError('Usá al menos 12 caracteres y repetí la misma contraseña.'); return }
    locked.current = true; setBusy(true); setError('')
    try {
      const { error: failure } = await client.auth.signUp({ email: form.email.trim(), password: form.password,
        options: { emailRedirectTo: publicApp, data: { first_name: form.first.trim(), last_name: form.last.trim(), phone: form.phone.trim(), registration_source: 'gns' } } })
      if (failure) setError(failure.status === 429 ? 'Esperá unos minutos antes de volver a solicitar el correo.' : 'No se pudo completar el registro. Si ya tenés cuenta, ingresá o recuperá tu contraseña. Si el problema continúa, contactá a GNS.')
      else { setSent(true); setForm(value => ({ ...value, password: '', repeat: '' })) }
    } catch { setError('No se pudo conectar. Revisá tu conexión y volvé a intentar.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <><a className="back" href="/">← Volver al ingreso</a><h1>Crear cuenta</h1>
    {sent ? <div role="status"><p>Revisá tu correo, incluida la carpeta de spam. Si corresponde un alta nueva, recibirás un enlace para confirmar tu dirección.</p><p>Abrilo para completar la solicitud. El acceso a tu panel se habilita cuando GNS aprueba tu cuenta.</p><a href="/">Ir al ingreso</a></div> :
      <form className="cloud-signin" onSubmit={submit}>
        <p>Creá tu cuenta y solicitá acceso al equipo de GNS.</p>
        <label>Nombre<input required maxLength={80} autoComplete="given-name" value={form.first} onChange={e => setForm({ ...form, first: e.target.value })}/></label>
        <label>Apellido<input required maxLength={80} autoComplete="family-name" value={form.last} onChange={e => setForm({ ...form, last: e.target.value })}/></label>
        <label>Correo electrónico<input type="email" required maxLength={254} autoCapitalize="none" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label>
        <label>Celular de contacto (opcional)<input type="tel" maxLength={30} autoComplete="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></label>
        <label>Contraseña<input type="password" required minLength={12} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/></label>
        <small>Al menos 12 caracteres. Evitá reutilizar otra contraseña.</small>
        <label>Repetir contraseña<input type="password" required minLength={12} autoComplete="new-password" value={form.repeat} onChange={e => setForm({ ...form, repeat: e.target.value })}/></label>
        <label className="registration-consent"><input type="checkbox" required/> Leí la <a href="/privacidad.html" target="_blank" rel="noopener noreferrer">política de privacidad</a>.</label>
        <button disabled={busy} type="submit">{busy ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      </form>}
    {error && <p className="error" role="alert">{error}</p>}
  </>
}

export function PendingRegistration({ client, user }: { client: SupabaseClient; user: User }) {
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [first, setFirst] = useState(String(user.user_metadata?.first_name ?? '').slice(0,80))
  const [last, setLast] = useState(String(user.user_metadata?.last_name ?? '').slice(0,80))
  const [phone, setPhone] = useState(String(user.user_metadata?.phone ?? '').slice(0,30))
  const started = useRef(false)
  const submit = useCallback(async (given: string, family: string, contact: string) => {
    setBusy(true); setError('')
    try {
      const { data, error: failure } = await client.rpc('submit_registration', { p_first_name: given, p_last_name: family, p_phone: contact })
      if (failure) throw failure
      setStatus(data)
    } catch { setError('No se pudo confirmar tu solicitud. Actualizá el estado o contactá a GNS.'); setStatus('retry') }
    finally { setBusy(false) }
  }, [client])
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active || started.current) return
      started.current = true
      const given = String(user.user_metadata?.first_name ?? '').trim()
      const family = String(user.user_metadata?.last_name ?? '').trim()
      if (given && family) void submit(given, family, String(user.user_metadata?.phone ?? ''))
      else void client.from('registration_requests').select('status').eq('user_id', user.id).maybeSingle().then(({ data, error: failure }) => {
        if (!active) return
        if (failure) { setError('No se pudo consultar tu solicitud. Volvé a intentar.'); setStatus('retry') }
        else setStatus(data?.status ?? 'new')
      })
    })
    return () => { active = false }
  }, [client, user, submit])
  async function refresh() {
    setBusy(true); setError('')
    try {
      const { error: failure } = await client.auth.refreshSession()
      if (failure) throw failure
      const assigned = await client.from('user_roles').select('role').eq('user_id',user.id).maybeSingle()
      if (assigned.error) throw assigned.error
      if (assigned.data?.role) return
      if (first.trim() && last.trim()) await submit(first.trim(), last.trim(), phone.trim())
      else setStatus('new')
    } catch { setError('No se pudo actualizar. Revisá tu conexión.') }
    finally { setBusy(false) }
  }
  return <section className="registration-status"><h2>{status === 'rejected' ? 'Solicitud no habilitada' : 'Solicitud de acceso'}</h2>
    {status === 'checking' ? <p role="status">Comprobando tu solicitud…</p> : status === 'rejected' ? <p>GNS no habilitó esta solicitud. Contactá al equipo si necesitás revisarla.</p> : status === 'pending' || status === 'approved' ? <p role="status">{status === 'approved' ? 'Tu cuenta fue aprobada. Actualizá el estado para ingresar.' : 'Tu correo está confirmado. El administrador revisará tu solicitud antes de habilitar tu panel.'}</p> :
      <form className="cloud-signin" onSubmit={event => { event.preventDefault(); void submit(first.trim(), last.trim(), phone.trim()) }}>
        <label>Nombre<input required maxLength={80} value={first} onChange={e => setFirst(e.target.value)}/></label>
        <label>Apellido<input required maxLength={80} value={last} onChange={e => setLast(e.target.value)}/></label>
        <label>Celular de contacto (opcional)<input type="tel" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)}/></label>
        <button disabled={busy}>Solicitar acceso</button>
      </form>}
    <button className="secondary" type="button" disabled={busy} onClick={() => void refresh()}>Actualizar estado</button>
    {error && <p role="alert" className="error">{error}</p>}
  </section>
}
