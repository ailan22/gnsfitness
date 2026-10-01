import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptBackup, encryptBackup, validateBackup } from './backupCrypto'

export default function BackupPanel({ client }: { client: SupabaseClient }) {
  const [password,setPassword] = useState(''), [confirmation,setConfirmation] = useState('')
  const [message,setMessage] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const [file,setFile] = useState<File | null>(null)
  const lock = useRef(false)
  async function run(verify: boolean) {
    if (lock.current) return
    setMessage('');setError('')
    if (password.length<16 || (!verify && password!==confirmation)) { setError('Usá una frase de al menos 16 caracteres y repetila igual para crear la copia.'); return }
    lock.current=true;setBusy(true)
    try {
      if (verify) {
        if (!file || file.size>70_000_000) throw Error('Elegí un respaldo .gnsbackup de hasta 70 MB')
        const data = await decryptBackup(await file.text(),password)
        const count = Object.values(data.tables).reduce((n,rows)=>n+rows.length,0)
        setMessage(`Archivo descifrado e íntegro: ${count} registros en ${Object.keys(data.tables).length} tablas. Creado ${data.createdAt}. Esta comprobación no restaura datos ni certifica una recuperación completa del servidor.`)
      } else {
        const result = await client.rpc('export_application_backup')
        if (result.error) throw Error('No se pudo obtener una copia completa. Revisá tu conexión y el doble factor; no se descargó un respaldo parcial.')
        validateBackup(result.data)
        const encrypted = await encryptBackup(result.data,password)
        await decryptBackup(encrypted,password)
        const url = URL.createObjectURL(new Blob([encrypted],{type:'application/octet-stream'}))
        const link = document.createElement('a');link.href=url;link.download=`gns-${new Date().toISOString().replace(/[:.]/g,'-')}.gnsbackup`;link.click()
        setTimeout(()=>URL.revokeObjectURL(url),60_000)
        setMessage('Descarga solicitada. Comprobá que el archivo se guardó y usá «Verificar archivo» para revisarlo. Guardá otra copia fuera de esta PC y la frase por separado.')
      }
    } catch(error) { setError(error instanceof Error ? error.message : 'No se pudo completar la operación. No se modificaron datos.') }
    finally {lock.current=false;setBusy(false);setPassword('');setConfirmation('')}
  }
  return <details className="card account-privacy"><summary>Respaldo cifrado y soporte</summary>
    <p>Copia manual de socios, planes, pagos, rutinas, entrenamientos, fichas de salud y solicitudes. Solo administración con doble factor.</p>
    <p className="muted">No incluye contraseñas, cuentas de acceso completas, archivos del servidor ni configuración. Complementa las copias del proveedor. La restauración se prepara y prueba en un entorno separado; esta pantalla no sobrescribe datos.</p>
    <fieldset className="plain-fieldset" disabled={busy}><div className="grid">
      <label>Frase de protección (mínimo 16 caracteres)<input type="password" autoComplete="new-password" minLength={16} maxLength={1024} value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <label>Repetir frase para crear copia<input type="password" autoComplete="new-password" maxLength={1024} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
    </div><p className="muted">La frase no se envía al servidor ni queda guardada en la app. Si la perdés no podremos abrir esta copia. No la compartas por chat o correo.</p>
    <button type="button" onClick={()=>void run(false)}>Descargar copia cifrada</button>
    <label>Verificar un archivo descargado<input type="file" accept=".gnsbackup" onChange={e=>setFile(e.target.files?.[0] ?? null)}/></label>
    <button type="button" className="secondary" disabled={!file} onClick={()=>void run(true)}>Verificar archivo</button></fieldset>
    {busy && <p role="status">Procesando copia…</p>}{message && <p role="status">{message}</p>}{error && <p role="alert" className="error">{error}</p>}
    <p>Soporte: <a href="mailto:gndevicciconde@gmail.com">gndevicciconde@gmail.com</a>. Indicá dispositivo y mensaje de error; no adjuntes fichas ni respaldos.</p>
  </details>
}
