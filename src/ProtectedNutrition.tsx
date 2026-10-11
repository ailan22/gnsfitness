import { useEffect, useState, type ReactNode } from 'react'

type GuardWindow = Window & { webkit?: { messageHandlers?: { gnsContentGuard?: { postMessage: (value: { enabled: boolean }) => void } } } }
const nativeGuard = () => (window as GuardWindow).webkit?.messageHandlers?.gnsContentGuard

// Copy deterrents, not DRM: authorized content can still be photographed.
export default function ProtectedNutrition({ children, owner }: { children: ReactNode; owner: string }) {
  const [hidden, setHidden] = useState(document.visibilityState !== 'visible')
  const [ready, setReady] = useState(() => !nativeGuard())
  const [notice, setNotice] = useState(false)
  useEffect(() => {
    const visibility = () => setHidden(document.visibilityState !== 'visible')
    const acknowledged = () => setReady(true)
    const screenshot = () => setNotice(true)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('gns-guard-ready', acknowledged)
    window.addEventListener('gns-screenshot', screenshot)
    nativeGuard()?.postMessage({ enabled: true })
    document.body.classList.add('nutrition-reading')
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('gns-guard-ready', acknowledged)
      window.removeEventListener('gns-screenshot', screenshot)
      nativeGuard()?.postMessage({ enabled: false })
      document.body.classList.remove('nutrition-reading')
    }
  }, [])
  return <div className="protected-nutrition" onCopy={e => e.preventDefault()} onCut={e => e.preventDefault()} onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>
    {notice && <p className="notice" role="status">Este material es para tu uso personal. Evitá compartir capturas o copias.</p>}
    <div className="nutrition-watermarks" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i}>GNS FITNESS · {owner}</span>)}</div>
    <div className="nutrition-protected-body" style={{ visibility: hidden || !ready ? 'hidden' : 'visible' }}>{children}</div>
    {!ready && <p role="status">Preparando lectura protegida…</p>}
  </div>
}
