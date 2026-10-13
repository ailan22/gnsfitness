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
    {biometricSaved && <button className="signin-biometric" type="button" disabled={pending} onClick={onUnlock}><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M5 14a11 11 0 0 1 22 0M3 20v-4m26 0v5M8 24c2-3 1-6 1-9a7 7 0 0 1 14 0c0 6 1 10 3 13M12 28c2-5 1-9 1-13a3 3 0 0 1 6 0c0 6 0 10 3 15M16 15c0 6 0 11 2 15M5 17c0 4-1 7-2 9M9 6a13 13 0 0 1 14 0"/></svg>Ingresar con {biometricLabel}</button>}
    <p className="signin-signature">GYM NATURE SOUL</p>
  </>
}
