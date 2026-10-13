import { useState, type FormEvent } from 'react'
import './StudentEntry.css'

export default function SignInForm({ email, password, setEmail, setPassword, pending, phoneAccess, registration, localSignout, biometricSaved, biometricLabel, onUnlock, onSubmit }: {
  email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void;
  pending: boolean; phoneAccess: boolean; registration: boolean; localSignout: boolean;
  biometricSaved: boolean; biometricLabel: string; onUnlock: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [visible, setVisible] = useState(false)
  return <>
    <form className="cloud-signin gns-signin-form" onSubmit={onSubmit}>
      <header className="signin-welcome"><h1>BIENVENIDO</h1><p>Ingresá a tu cuenta</p></header>
      {localSignout && <p role="status">El acceso se cerró en este dispositivo. Sin conexión no se pudo confirmar la revocación en el servidor.</p>}
      <label>{phoneAccess ? 'Correo o celular' : 'Correo electrónico'}<input type={phoneAccess ? 'text' : 'email'} placeholder={phoneAccess ? 'Correo o +598…' : 'nombre@correo.com'} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label>
      {phoneAccess && <small>Para celular, incluí el código de país. Primero vinculalo desde tu cuenta.</small>}
      <div className="signin-password"><label htmlFor="gns-signin-password">Contraseña</label><div><input id="gns-signin-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/><button className="signin-eye" type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible} onClick={() => setVisible(v => !v)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}</svg></button></div></div>
      <a className="signin-recovery" href="/reset-password?request=1">Olvidé mi contraseña</a>
      <button className="signin-submit" type="submit" disabled={pending}>{pending ? 'Ingresando…' : <>INGRESAR <span aria-hidden="true">→</span></>}</button>
      {registration && <p className="signin-create">¿Primera vez? <a href="/?registro=1">Crear cuenta</a></p>}
    </form>
    {biometricSaved && <button className="signin-biometric" type="button" disabled={pending} onClick={onUnlock}><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M3 10V5a2 2 0 0 1 2-2h5m12 0h5a2 2 0 0 1 2 2v5M3 22v5a2 2 0 0 0 2 2h5m12 0h5a2 2 0 0 0 2-2v-5M11 11v4m10-4v4m-5-4v8h-2m-4 3q6 5 12 0"/></svg>Ingresar con {biometricLabel}</button>}
    <p className="signin-signature">GYM NATURE SOUL</p>
  </>
}
