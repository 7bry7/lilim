import { useEffect, useState } from 'react'

const read = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

// Tracks connectivity through navigator.onLine and the online/offline events
// (R17.8, R17.9). The events fire immediately, well inside the 2 s budget.
export function useOnlineStatus() {
  const [online, setOnline] = useState(read)
  useEffect(() => {
    const update = () => setOnline(read())
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    update()
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
