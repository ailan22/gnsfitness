import type { SupabaseClient, User } from '@supabase/supabase-js'

type Callbacks = {
  loading: () => void
  signedOut: () => void
  account: (user: User, role: string | null) => void
  recovery: () => void
  error: (message: string) => void
}

// One loader per mounted account view. Repeated SIGNED_IN events must not
// unmount the portal or repeat all its queries when the browser gains focus.
export function observeAccount(client: SupabaseClient, callbacks: Callbacks, initiallyRecovering = false) {
  let active = true
  let currentId: string | null = null
  let generation = 0
  let ready = false
  let inFlight = false
  let recovering = initiallyRecovering
  let timer: ReturnType<typeof setTimeout> | undefined

  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    if (!active) return
    const startedRecovery = event === 'PASSWORD_RECOVERY' && !recovering
    if (event === 'PASSWORD_RECOVERY') {
      recovering = true
      callbacks.recovery()
    }
    const id = session?.user.id ?? null
    if (!id) {
      generation++
      clearTimeout(timer)
      currentId = null; ready = false; inFlight = false
      callbacks.signedOut()
      return
    }

    const changedAccount = currentId !== id
    const refresh = event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'
    if (!changedAccount && !startedRecovery && (inFlight || (ready && !refresh))) return
    currentId = id
    const request = ++generation
    clearTimeout(timer)
    if (changedAccount || startedRecovery || !ready) callbacks.loading()
    if (changedAccount || startedRecovery) ready = false
    inFlight = true

    // Do not await another Auth call while Supabase's event callback holds its lock.
    timer = setTimeout(() => {
      if (!active || request !== generation) return
      void (async () => {
        try {
          const [account, role] = await Promise.all([
            client.auth.getUser(),
            recovering ? Promise.resolve(null) : client.from('user_roles').select('role').eq('user_id', id).maybeSingle(),
          ])
          if (!active || request !== generation) return
          if (account.error || !account.data.user || account.data.user.id !== id) {
            ready = false
            callbacks.error('No se pudo comprobar la sesión. Volvé a iniciar sesión.')
            return
          }
          if (role?.error) {
            ready = false
            callbacks.error('No se pudo consultar tu acceso. Actualizá la página para volver a intentar.')
            return
          }
          ready = true
          callbacks.account(account.data.user, role?.data?.role ?? null)
        } catch {
          if (active && request === generation) {
            ready = false
            callbacks.error('No se pudo conectar para comprobar tu acceso. Revisá tu conexión e intentá nuevamente.')
          }
        } finally {
          if (active && request === generation) inFlight = false
        }
      })()
    }, 0)
  })

  return () => {
    active = false
    generation++
    clearTimeout(timer)
    subscription.unsubscribe()
  }
}
