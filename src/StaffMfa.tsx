import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// This gate improves the UI; migration 007 independently enforces aal2 in SQL.
export default function StaffMfa({ client, children, onVerified }: {
  client: SupabaseClient; children: ReactNode; onVerified: (verified: boolean) => void
}) {
  const [verified, setVerified] = useState(false)
  const [checking, setChecking] = useState(true)
  const [factor, setFactor] = useState('')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let generation = 0
    const check = async () => {
      const request = ++generation
      try {
        const [assurance, factors] = await Promise.all([
          client.auth.mfa.getAuthenticatorAssuranceLevel(), client.auth.mfa.listFactors(),
        ])
        if (!active || request !== generation) return
        if (assurance.error || factors.error) throw Error('verification')
        const ready = assurance.data.currentLevel === 'aal2'
        setVerified(ready); onVerified(ready)
        setFactor(current => factors.data.totp.find(item => item.status === 'verified')?.id ?? current)
        if (ready) { setQr(''); setSecret(''); setCode('') }
        setError('')
      } catch {
        if (active && request === generation) {
          setVerified(false); onVerified(false)
          setError('No se pudo comprobar la protección de tu cuenta. Reintentá.')
        }
      } finally { if (active && request === generation) setChecking(false) }
    }
    void check()
    const { data: { subscription } } = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { generation++; setVerified(false); onVerified(false); return }
      if (event === 'MFA_CHALLENGE_VERIFIED' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        clearTimeout(timer); timer = setTimeout(() => { void check() }, 0)
      }
    })
    return () => { active = false; generation++; clearTimeout(timer); subscription.unsubscribe() }
  }, [client, onVerified, revision])

  async function enroll() {
    if (pending) return
    setPending(true); setError('')
    try {
      // Clean only unfinished setup owned by this screen, never a verified factor.
      const factors = await client.auth.mfa.listFactors()
      if (factors.error) throw factors.error
      for (const item of factors.data.all.filter(item => item.factor_type === 'totp' && item.status === 'unverified' && item.friendly_name === 'GNS FITNESS')) {
        const removed = await client.auth.mfa.unenroll({ factorId: item.id })
        if (removed.error) throw removed.error
      }
      const result = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'GNS FITNESS' })
      if (result.error) throw result.error
      setFactor(result.data.id); setQr(result.data.totp.qr_code); setSecret(result.data.totp.secret)
    } catch { setError('No se pudo iniciar la configuración. Reintentá.') }
    finally { setPending(false) }
  }
  async function verify(event: FormEvent) {
    event.preventDefault()
    if (pending || !factor || !/^\d{6}$/.test(code)) return
    setPending(true); setError('')
    try {
      const challenge = await client.auth.mfa.challenge({ factorId: factor })
      if (challenge.error) throw challenge.error
      const result = await client.auth.mfa.verify({ factorId: factor, challengeId: challenge.data.id, code })
      if (result.error) throw result.error
      setQr(''); setSecret(''); setCode(''); setChecking(true); setRevision(value => value + 1)
    } catch { setCode(''); setError('No se pudo validar el código. Usá el código actual de tu autenticador y reintentá.') }
    finally { setPending(false) }
  }
  if (checking) return <p role="status">Comprobando la seguridad de tu cuenta…</p>
  if (verified) return <>{children}</>
  return <section className="card" aria-label="Verificación de seguridad">
    <h2>Protegé tu acceso administrativo</h2>
    <p>Para acceder a los datos de los alumnos, verificá tu identidad con un código de una aplicación autenticadora.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {error && <button type="button" className="secondary" onClick={() => { setChecking(true); setRevision(value => value + 1) }}>Volver a comprobar</button>}
    {!factor ? <><p>Configurá el autenticador en tu celular. Guardá su respaldo en un lugar privado para recuperar el acceso si cambiás de teléfono.</p><button type="button" disabled={pending} onClick={() => void enroll()}>Configurar doble factor</button></> : <>
      {qr && <><p>Escaneá este QR desde tu aplicación autenticadora. No lo compartas ni envíes capturas.</p><img src={qr} alt="Código QR privado para configurar tu autenticador" width="220" height="220"/><details><summary>Ingresar la clave manualmente</summary><code>{secret}</code></details></>}
      <form onSubmit={verify}><label>Código del autenticador<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))}/></label><button disabled={pending} type="submit">{pending ? 'Verificando…' : 'Verificar y entrar'}</button></form>
    </>}
  </section>
}
