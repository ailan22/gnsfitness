// The native SDK session lives in memory. Only an AES-GCM encrypted copy is
// persisted; its random key can be recovered only through the OS biometric vault.
type Vault = {
  save: (value: string) => Promise<void>
  read: () => Promise<string>
  remove: () => Promise<void>
}
type Disk = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const decode = (text: string) => Uint8Array.from(atob(text), char => char.charCodeAt(0))

export class BiometricSession {
  private memory = new Map<string, string>()
  private key: CryptoKey | null = null
  private queue: Promise<unknown> = Promise.resolve()
  readonly diskKey: string
  readonly sessionKey: string
  private disk: Disk
  private vault: Vault

  constructor(sessionKey: string, disk: Disk, vault: Vault) {
    this.sessionKey = sessionKey
    this.disk = disk
    this.vault = vault
    this.diskKey = `${sessionKey}.biometric.v1`
    // Upgrade from the previous native build: require password once, never
    // silently enroll a previously persisted browser session.
    for (const suffix of ['', '-user', '-code-verifier']) disk.removeItem(sessionKey + suffix)
  }

  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action)
    this.queue = result.catch(() => undefined)
    return result
  }

  get enabled() { return this.key !== null }
  get saved() { return this.disk.getItem(this.diskKey) !== null }
  getItem = async (name: string) => this.memory.get(name) ?? null

  setItem = (name: string, value: string) => this.serial(async () => {
    this.memory.set(name, value)
    if (name === this.sessionKey && this.key) await this.persist(value)
  })

  removeItem = (name: string) => this.serial(async () => {
    this.memory.delete(name)
    if (name === this.sessionKey) await this.erase()
  })

  private async persist(value: string) {
    if (!this.key) throw new Error('Locked')
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
      additionalData: new TextEncoder().encode(this.sessionKey) }, this.key, new TextEncoder().encode(value))
    this.disk.setItem(this.diskKey, JSON.stringify({ v: 1, iv: encode(iv), data: encode(new Uint8Array(cipher)) }))
  }

  private async erase() {
    this.key = null
    // Remove ciphertext first: even if a native delete fails, the remaining
    // vault key alone cannot restore the previous account.
    this.disk.removeItem(this.diskKey)
    await this.vault.remove()
  }

  disable = () => this.serial(() => this.erase())

  enable = () => this.serial(async () => {
    const session = this.memory.get(this.sessionKey)
    if (!session) throw new Error('No session')
    try {
      await this.erase()
      const raw = crypto.getRandomValues(new Uint8Array(32))
      await this.vault.save(encode(raw))
      // Confirm enrollment by actually decrypting the protected key. Saving a
      // Keychain item alone does not prompt for Face ID on iOS.
      const verified = decode(await this.vault.read())
      if (encode(verified) !== encode(raw)) throw new Error('Invalid vault key')
      this.key = await crypto.subtle.importKey('raw', verified, 'AES-GCM', false, ['encrypt', 'decrypt'])
      await this.persist(session)
    } catch (error) {
      await this.erase()
      throw error
    }
  })

  unlock = () => this.serial(async (): Promise<{ access_token: string; refresh_token: string }> => {
    const payload = this.disk.getItem(this.diskKey)
    if (!payload) throw new Error('No saved session')
    // Do not touch the SDK session until native authentication AND authenticated
    // decryption succeed. Cancellation leaves the password form usable.
    const raw = decode(await this.vault.read())
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
    const data = JSON.parse(payload)
    if (data.v !== 1) throw new Error('Unknown session version')
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(data.iv),
      additionalData: new TextEncoder().encode(this.sessionKey) }, key, decode(data.data))
    const session = JSON.parse(new TextDecoder().decode(plain))
    if (typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string') throw new Error('Invalid session')
    this.key = key
    return { access_token: session.access_token, refresh_token: session.refresh_token }
  })
}
