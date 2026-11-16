import { useCallback, useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Registers the service worker only in a secure context (R17.14). Failures
// (registration, offline update checks) are swallowed (R17.15, R17.16).
// Never reloads by itself (R17.10): `applyUpdate` must be called by the user.
export function useServiceWorker() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.isSecureContext) return
    try {
      updateRef.current = registerSW({
        onNeedRefresh: () => setNeedRefresh(true),
        onRegisterError: () => {},
        onRegisteredSW: (_url, reg) => {
          // Quiet update check on load; offline failures are ignored.
          Promise.resolve(reg?.update?.()).catch(() => {})
        },
      })
    } catch {
      updateRef.current = null
    }
  }, [])

  const applyUpdate = useCallback(() => {
    try {
      Promise.resolve(updateRef.current?.(true)).catch(() => {})
    } catch {
      /* ignore */
    }
  }, [])

  const dismiss = useCallback(() => setNeedRefresh(false), [])

  return { needRefresh, applyUpdate, dismiss }
}
