export const backupTables = ['user_roles','members','member_admin_notes','routines','memberships','payments','sessions','session_reviews','health_records','member_progress','service_requests','privacy_requests'] as const
export type ApplicationBackup = { format: 'gns-application-backup'; version: 1; schemaVersion: 13; createdAt: string; tables: Record<typeof backupTables[number], Record<string, unknown>[]> }
const maxBytes = 50_000_000
const iterations = 600_000
const aad = new TextEncoder().encode('GNS encrypted backup v1')
function base64(bytes: Uint8Array) {
  let result = ''
  for (let i=0; i<bytes.length; i+=8192) result += String.fromCharCode(...bytes.subarray(i,i+8192))
  return btoa(result)
}
function decode(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max*4/3+8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw Error('Archivo inválido')
  return Uint8Array.from(atob(value), c => c.charCodeAt(0))
}
export function validateBackup(value: unknown): asserts value is ApplicationBackup {
  const data = value as ApplicationBackup
  if (!data || data.format !== 'gns-application-backup' || data.version !== 1 || data.schemaVersion !== 13 || !Number.isFinite(Date.parse(data.createdAt)) || !data.tables || Object.keys(data.tables).length !== backupTables.length) throw Error('Formato de respaldo no compatible')
  for (const name of backupTables) {
    const rows = data.tables[name]
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('Respaldo incompleto')
    const key = name === 'user_roles' ? 'user_id' : name === 'member_admin_notes' ? 'member_id' : name === 'session_reviews' ? 'session_id' : 'id'
    const ids = rows.map(row => row[key])
    if (ids.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) || new Set(ids).size !== ids.length) throw Error('Identificadores inválidos o repetidos')
  }
}
async function keyFor(password: string, salt: Uint8Array<ArrayBuffer>) {
  if (password.length < 16 || password.length > 1024) throw Error('Usá una frase de al menos 16 caracteres y hasta 1024')
  const raw = await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey'])
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])
}
export async function encryptBackup(data: ApplicationBackup, password: string) {
  validateBackup(data)
  const raw = new TextEncoder().encode(JSON.stringify(data))
  if (raw.byteLength > maxBytes) throw Error('Respaldo demasiado grande; requiere copia del proveedor')
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},await keyFor(password,salt),raw)
  return JSON.stringify({format:'gns-encrypted-backup',version:1,kdf:'PBKDF2-SHA256',iterations,cipher:'AES-256-GCM',salt:base64(salt),iv:base64(iv),ciphertext:base64(new Uint8Array(ciphertext))})
}
export async function decryptBackup(file: string, password: string): Promise<ApplicationBackup> {
  if (file.length > 70_000_000) throw Error('Archivo demasiado grande')
  const envelope = JSON.parse(file)
  if (envelope?.format !== 'gns-encrypted-backup' || envelope.version !== 1 || envelope.iterations !== iterations || envelope.kdf !== 'PBKDF2-SHA256' || envelope.cipher !== 'AES-256-GCM') throw Error('Formato cifrado no compatible')
  const salt = decode(envelope.salt,16), iv = decode(envelope.iv,12), ciphertext = decode(envelope.ciphertext,maxBytes+16)
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16 || ciphertext.length > maxBytes+16) throw Error('Archivo inválido')
  let decoded: ArrayBuffer
  try { decoded = await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},await keyFor(password,salt),ciphertext) }
  catch { throw Error('No se pudo abrir: frase incorrecta o archivo dañado') }
  const data: unknown = JSON.parse(new TextDecoder().decode(decoded))
  validateBackup(data)
  return data
}
