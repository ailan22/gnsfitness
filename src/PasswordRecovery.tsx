import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { recoveryUrl } from './recoveryUrl'

export default function PasswordRecovery({ client, authenticated, checking, invalidLink }: {
  client: SupabaseClient
  authenticated: boolean
  checking: boolean
  invalidLink: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || sent) return
    setPending(true); setError('')
    try {
      const { error: failure } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: recoveryUrl(Capacitor.isNativePlatform(), window.location.origin),
      })
      if (failure) {
        setError(failure.status === 429
          ? 'Se solicitaron varios correos. Esperá unos minutos antes de volver a intentar.'
          : 'No se pudo enviar el correo de recuperación. Intentá nuevamente en unos minutos.')
      } else setSent(true)
    } catch {
      setError('No se pudo conectar. Revisá tu conexión e intentá nuevamente.')
    } finally { setPending(false) }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || saved || !authenticated || invalidLink) return
    setError('')
    if (password.length < 12) { setError('Usá una contraseña de al menos 12 caracteres.'); return }
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return }
    setPending(true)
    try {
      const { error: failure } = await client.auth.updateUser({ password })
      if (failure) {
        if (failure.code === 'same_password') setError('Elegí una contraseña diferente de la anterior.')
        else if (failure.code === 'weak_password') setError('La contraseña no cumple los requisitos. Probá una más larga con mayúsculas, minúsculas, números y símbolos.')
        else if (failure.status === 401 || failure.status === 403 || failure.code === 'session_not_found') setError('La sesión de recuperación venció. Solicitá un enlace nuevo.')
        else setError('No se pudo guardar la contraseña. Intentá nuevamente o solicitá un enlace nuevo.')
      } else setSaved(true)
    } catch {
      setError('No se pudo confirmar el cambio. Revisá tu conexión antes de volver a intentar.')
    } finally {
      setPassword(''); setConfirmation(''); setPending(false)
    }
  }

  return <>
    <img className="signin-logo" src="/gns-logo-transparent.png" alt="GNS Fitness" width="128" height="128"/>
    <p className="eyebrow">TU ESPACIO · GNS FITNESS</p>
    <h1>{saved ? 'Contraseña actualizada.' : 'Recuperá tu acceso.'}</h1>
    {checking ? <p role="status">Comprobando el enlace…</p> : saved ?
      <div className="cloud-signin"><p role="status">Tu contraseña nueva se guardó correctamente.</p><a href="/">Continuar a GNS Fitness</a></div> : authenticated && !invalidLink ?
      <form className="cloud-signin" onSubmit={savePassword}>
        <p className="muted">Elegí una contraseña de al menos 12 caracteres que no uses en otros servicios.</p>
        <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} required disabled={pending} value={password} onChange={event => setPassword(event.target.value)}/></label>
        <label>Repetir contraseña<input type="password" autoComplete="new-password" minLength={12} required disabled={pending} value={confirmation} onChange={event => setConfirmation(event.target.value)}/></label>
        <button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar contraseña nueva'}</button>
        <a href="/reset-password?request=1">Solicitar otro enlace</a>
      </form> :
      <form className="cloud-signin" onSubmit={requestRecovery}>
        {invalidLink && <p className="error" role="alert">El enlace no es válido o ya venció. Solicitá uno nuevo.</p>}
        <p className="muted">Te enviaremos un enlace para elegir una contraseña nueva.</p>
        <label>Correo electrónico<input type="email" autoComplete="email" required disabled={pending || sent} value={email} onChange={event => setEmail(event.target.value)}/></label>
        <button type="submit" disabled={pending || sent}>{pending ? 'Enviando…' : sent ? 'Solicitud enviada' : 'Enviar enlace de recuperación'}</button>
        {sent && <p role="status">Si el correo corresponde a una cuenta habilitada, recibirás un enlace. Revisá también Spam y abrí el mensaje más reciente. Después de cambiar la contraseña, volvé a GNS FITNESS para ingresar.</p>}
        <a href="/">Volver al inicio de sesión</a>
      </form>}
    {error && <p className="error" role="alert">{error}</p>}
  </>
}
