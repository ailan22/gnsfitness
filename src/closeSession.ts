// The caller reloads afterwards to discard SDK and component memory.
export async function closeSession({ revoke, disableBiometrics, disk, sessionKey, timeoutMs = 8000 }: {
  revoke: () => Promise<{ error: unknown }>
  disableBiometrics?: () => Promise<void>
  disk: Pick<Storage, 'removeItem'>
  sessionKey: string
  timeoutMs?: number
}) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const localCleanup = () => {
    for (const suffix of ['', '-user', '-code-verifier', '.biometric.v1']) disk.removeItem(sessionKey + suffix)
  }
  try {
    const result = await Promise.race([
      Promise.allSettled([Promise.resolve().then(revoke), Promise.resolve().then(disableBiometrics)]),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs) }),
    ])
    return { remoteRevoked: result !== null && result[0].status === 'fulfilled' && !result[0].value?.error }
  } finally {
    clearTimeout(timer)
    // A token refresh in flight may have persisted during revocation.
    localCleanup()
  }
}
