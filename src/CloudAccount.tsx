import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import { observeAccount } from './observeAccount'
import { loginIdentifier } from './loginIdentifier'
import PhoneAccess from './PhoneAccess'
import PasswordRecovery from './PasswordRecovery'
import StaffMfa from './StaffMfa'
import BotanicalCorners from './BotanicalCorners'
import { closeSession } from './closeSession'
import { biometricAvailability, nativePlatform, nativeSessionStorage } from './nativeBiometrics'

const CloudAdmin = lazy(() => import('./CloudAdmin'))
const CloudStudent = lazy(() => import('./CloudStudent'))
// Enable only after the SMS provider and phone confirmation are configured and tested.
const phoneAccessEnabled = import.meta.env.VITE_PHONE_ACCESS_ENABLED === 'true'

// Read only the callback kind before the SDK consumes the URL fragment.
const callbackParameters = new URLSearchParams(window.location.hash.slice(1))
const callbackFailed = callbackParameters.has('error') || callbackParameters.has('error_code')
const recoveryRequested = window.location.pathname === '/reset-password' || ['recovery', 'invite'].includes(callbackParameters.get('type') ?? '') || callbackFailed
const requestOnly = new URLSearchParams(window.location.search).get('request') === '1'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const configured = Boolean(url && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && key &&
  !/^(your|tu-|pega|sb_secret_|eyJ)/i.test(key))

// Only the public browser key belongs in Vite environment variables.
const sessionKey = configured ? `sb-${new URL(url!).hostname.split('.')[0]}-auth-token` : 'gns-auth'
const nativeStorage = configured ? nativeSessionStorage(sessionKey) : undefined
const client = configured ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true,
  ...(nativeStorage ? { storage: nativeStorage, storageKey: sessionKey, detectSessionInUrl: false } : {}),
} }) : null

export default function CloudAccount({ onAccessChange, onExportLocal, hasLocalData }: {
  onAccessChange?: (access: 'checking' | 'student' | 'admin' | 'other' | 'signed-out') => void
  onExportLocal?: () => void
  hasLocalData?: boolean
}) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [staffVerified, setStaffVerified] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(client))
  const [recovering, setRecovering] = useState(recoveryRequested)
  const [biometry, setBiometry] = useState({ available: false, label: 'biometría' })
  const [biometricSaved, setBiometricSaved] = useState(Boolean(nativeStorage?.saved))
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricMessage, setBiometricMessage] = useState('')
  const recoveryMode = useRef(recoveryRequested)
  const roleLabel = useMemo(() => ({ admin: 'Administrador', trainer: 'Entrenador', student: 'Alumno' })[role || ''] || 'Sin rol asignado', [role])

  useEffect(() => {
    if (!nativePlatform) return
    let active = true
    const check = () => { void biometricAvailability().then(value => { if (active) setBiometry(value) }) }
    check()
    window.addEventListener('focus', check)
    return () => { active = false; window.removeEventListener('focus', check) }
  }, [])

  useEffect(() => {
    if (!client) return
    const clearAccount = () => {
      setUser(null); setRole(null); setStaffVerified(false)
    }
    return observeAccount(client, {
      loading: () => {
        clearAccount(); setLoading(true); setError('')
      },
      signedOut: () => {
        clearAccount(); setLoading(false)
        setBiometricSaved(Boolean(nativeStorage?.saved)); setBiometricEnabled(false)
      },
      recovery: () => {
        recoveryMode.current = true; setRecovering(true)
        window.history.replaceState(null, '', '/reset-password')
      },
      account: (account, nextRole) => {
        setUser(account); setRole(nextRole); setLoading(false); setError('')
      },
      error: message => {
        clearAccount(); setLoading(false); setError(message)
      },
    }, recoveryMode.current)
  }, [onAccessChange])

  useEffect(() => {
    onAccessChange?.(loading ? 'checking' : !user ? 'signed-out' : recovering ? 'other'
      : role === 'student' ? 'student' : role === 'admin' && staffVerified ? 'admin' : 'other')
  }, [loading, user, recovering, role, staffVerified, onAccessChange])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client || pending) return
    const identifier = loginIdentifier(email)
    if (!identifier) { setError('Ingresá un correo válido o un celular con código de país, por ejemplo +598 99 123 456.'); return }
    if ('phone' in identifier && !phoneAccessEnabled) { setError('El ingreso por celular todavía está en preparación. Por ahora ingresá con tu correo.'); return }
    setPending(true); setError('')
    try {
      // Explicit password login starts a new account context, never inherits
      // another person's biometric enrollment on a shared phone.
      if (nativeStorage) {
        await nativeStorage.disable()
        setBiometricSaved(false); setBiometricEnabled(false); setBiometricMessage('')
      }
      const { error: authError } = await client.auth.signInWithPassword({ ...identifier, password })
      if (authError) setError(authError.code === 'email_not_confirmed'
        ? 'Falta confirmar el correo de esta cuenta.'
        : authError.code === 'invalid_credentials'
          ? 'Los datos de acceso no coinciden. Podés recuperar tu acceso con «Olvidé mi contraseña».'
          : authError.status === 429
            ? 'Demasiados intentos. Esperá unos minutos antes de volver a intentar.'
            : 'No se pudo conectar o completar el ingreso. Intentá nuevamente en unos minutos.')
    } catch { setError('No se pudo conectar. Revisá tu conexión e intentá nuevamente.') }
    finally { setPassword(''); setPending(false) }
  }

  async function signOut() {
    if (!client || pending) return
    setClosing(true); setPending(true); setError('')
    try {
      const result = await closeSession({ revoke: () => client.auth.signOut(),
        disableBiometrics: nativeStorage ? () => nativeStorage.disable() : undefined,
        disk: window.localStorage, sessionKey })
      window.location.replace(result.remoteRevoked ? '/' : '/?local-signout=1')
    } catch {
      setError('No se pudo confirmar el cierre. Cerrá completamente la app o el navegador antes de dejar el dispositivo.')
    }
  }

  async function toggleBiometrics() {
    if (!nativeStorage || pending) return
    setPending(true); setError(''); setBiometricMessage('')
    try {
      if (nativeStorage.enabled) {
        await nativeStorage.disable()
        setBiometricMessage('Acceso biométrico desactivado en este celular.')
      } else {
        const available = await biometricAvailability()
        setBiometry(available)
        if (!available.available) throw new Error('Unavailable')
        await nativeStorage.enable()
        setBiometricMessage('Acceso biométrico activado para esta cuenta en este celular.')
      }
    } catch { setError('No se pudo completar la activación o desactivación. Podés seguir usando tu contraseña.') }
    finally {
      setBiometricSaved(nativeStorage.saved); setBiometricEnabled(nativeStorage.enabled); setPending(false)
    }
  }

  async function unlockBiometrics() {
    if (!nativeStorage || !client || pending) return
    setPending(true); setError('')
    try {
      const tokens = await nativeStorage.unlock()
      // Refresh against the server even when the stored access token has not
      // expired; observeAccount also checks getUser and the current role.
      const { error: authError } = await client.auth.refreshSession({ refresh_token: tokens.refresh_token })
      if (authError) throw authError
      setBiometricEnabled(true)
    } catch {
      setError('No se pudo ingresar con biometría. Podés reintentar o usar tu correo y contraseña.')
    } finally { setBiometricSaved(nativeStorage.saved); setPending(false) }
  }

  if (closing) return <section className="card"><p role="status">Cerrando sesión…</p>{error && <p role="alert">{error}</p>}</section>

  if (recovering && client) return <section className="card cloud-account cloud-portal" aria-label="Recuperación de acceso a GNS Fitness">
    <PasswordRecovery client={client} authenticated={Boolean(user) && !requestOnly} checking={loading} invalidLink={callbackFailed}/>
    {error && <p className="error" role="alert">{error}</p>}
  </section>

  return <section className={role === 'student' || !user ? 'card cloud-account cloud-portal' : role === 'admin' ? 'cloud-account cloud-admin-account' : 'card cloud-account'} aria-label="Acceso a GNS Fitness">
    {role !== 'admin' && <BotanicalCorners/>}
    {role === 'student' || role === 'admin' ? null : !user ? <><img className="signin-logo" src="/gns-logo-transparent.png" alt="GNS Fitness" width="128" height="128"/><h1>Entrá a tu espacio.</h1><p className="muted">Iniciá sesión con tu correo y contraseña para ver tu espacio personal.</p></> : <h2>Cuenta conectada</h2>}
    {!configured ? <p className="notice">Para activar la conexión, configurá la URL del proyecto y su clave publicable en <code>.env.local</code>, siguiendo <code>cloud/README.md</code>.</p> : loading ? <p>Comprobando cuenta…</p> : !user ?
      <form className="cloud-signin" onSubmit={signIn}>
        {new URLSearchParams(window.location.search).get('local-signout') === '1' && <p role="status">El acceso se cerró en este dispositivo. Sin conexión no se pudo confirmar la revocación en el servidor.</p>}
        {biometricSaved && <button type="button" disabled={pending} onClick={() => void unlockBiometrics()}>Ingresar con {biometry.label}</button>}
        <label>{phoneAccessEnabled ? 'Correo o celular' : 'Correo electrónico'}<input type={phoneAccessEnabled ? 'text' : 'email'} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label>
        {phoneAccessEnabled && <small>Para celular, incluí el código de país. Primero vinculalo desde tu cuenta.</small>}
        <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label>
        <button type="submit" disabled={pending}>{pending ? 'Ingresando…' : 'Iniciar sesión'}</button>
        <a href="/reset-password?request=1">Olvidé mi contraseña</a>
      </form> : <div className={role === 'student' ? 'student-account-layout' : undefined}>
        <Suspense fallback={<p role="status">Cargando tu espacio…</p>}>
        {role === 'admin' && client ? <StaffMfa key={user.id} client={client} onVerified={setStaffVerified}><CloudAdmin client={client}/>
          {hasLocalData && onExportLocal && <details className="local-archive"><summary>Respaldo de la demostración anterior</summary><p className="muted">La copia del navegador es independiente de los socios de Supabase. Descargala antes de borrar datos del navegador.</p><button type="button" className="secondary" onClick={onExportLocal}>Descargar respaldo anterior</button></details>}</StaffMfa> : !role ? <p className="notice">Esta cuenta aún no tiene un rol asignado. Contactá al administrador.</p> : null}
        {role === 'student' && client && <CloudStudent client={client} user={user}/>}
        </Suspense>
        <div className={role === 'student' ? 'student-account-bottom' : undefined}>
        {phoneAccessEnabled && client && <PhoneAccess key={user.id} client={client}/>}
        {nativePlatform && <details className="biometric-settings"><summary>Acceso con Face ID o biometría</summary>
          <h3>Acceso rápido en este celular</h3>
          <p className="muted">{biometricEnabled
            ? 'Al volver a iniciar la app, podés ingresar con biometría. Cerrar sesión elimina este acceso guardado.'
            : 'Activá el acceso biométrico después de ingresar con tu contraseña. Es opcional y solo se guarda en este celular.'}</p>
          {(biometry.available || biometricEnabled) ? <button type="button" className="secondary" disabled={pending} onClick={() => void toggleBiometrics()}>
            {biometricEnabled ? 'Desactivar acceso biométrico' : `Activar ${biometry.label}`}
          </button> : <p className="muted">No hay biometría compatible configurada en este dispositivo. Podés seguir ingresando con contraseña.</p>}
          {biometricMessage && <p role="status">{biometricMessage}</p>}
        </details>}
        {role !== 'student' && <footer className="account-details"><p><strong>Cuenta:</strong> {user.email}</p><p><strong>Rol:</strong> {roleLabel}</p></footer>}
        <button type="button" className="secondary cloud-signout" disabled={pending} onClick={() => void signOut()} aria-label="Cerrar sesión" title="Cerrar sesión">{role === 'student' ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h11"/></svg> : 'Cerrar sesión'}</button>
        </div>
      </div>}
    {error && <p className="error" role="alert">{error}</p>}
    <nav className="account-legal" aria-label="Privacidad y ayuda"><a href="/privacidad.html">Privacidad</a><a href="/soporte.html">Ayuda y soporte</a></nav>
  </section>
}
