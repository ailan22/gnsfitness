import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loginIdentifier } from './loginIdentifier'

export default function PhoneAccess({ client }: { client: SupabaseClient }) {
  const [number, setNumber] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  async function submit() {
    if (pending.current) return
    const identifier = loginIdentifier(number)
    if (!identifier || !('phone' in identifier)) { setMessage('Ingresá el celular con código de país, por ejemplo +598 99 123 456.'); return }
    if (sentTo && !/^\d{6}$/.test(code)) { setMessage('Ingresá los seis números del SMS.'); return }
    pending.current = true; setBusy(true); setMessage('')
    try {
      if (!sentTo) {
        const { error } = await client.auth.updateUser({ phone: identifier.phone })
        if (error) { setMessage('No se pudo enviar el código. Verificá el número o intentá más tarde; podés seguir entrando con correo.'); return }
        setSentTo(identifier.phone)
        setMessage('Te enviamos un código por SMS. Confirmalo para vincular este celular a tu cuenta.')
      } else {
        const { error } = await client.auth.verifyOtp({ phone: sentTo, token: code, type: 'phone_change' })
        if (error) { setMessage('El código no pudo verificarse. Revisalo o solicitá uno nuevo.'); return }
        setSentTo(''); setCode(''); setNumber('')
        setMessage('Celular verificado. Podés ingresar con ese número y tu contraseña actual. La recuperación sigue disponible por correo.')
      }
    } catch { setMessage('No se pudo conectar. Tu ingreso por correo sigue disponible.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <details className="phone-access"><summary>Ingresar también con celular</summary>
    <p>Vinculá tu número mediante un SMS. Usarás la misma contraseña; conservá tu correo para recuperarla.</p>
    <label>Celular con código de país<input type="tel" autoComplete="tel" value={number} disabled={busy || Boolean(sentTo)} onChange={event => setNumber(event.target.value)} placeholder="+598 99 123 456"/></label>
    {sentTo && <label>Código recibido<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))}/></label>}
    <button type="button" disabled={busy} onClick={() => void submit()}>{busy ? 'Procesando…' : sentTo ? 'Verificar celular' : 'Enviar código por SMS'}</button>
    {sentTo && <button type="button" disabled={busy} onClick={() => { setSentTo(''); setCode(''); setMessage('') }}>Cambiar número o solicitar otro código</button>}
    {message && <p role="status">{message}</p>}
  </details>
}
