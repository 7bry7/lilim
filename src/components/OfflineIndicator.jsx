import { useOnlineStatus } from '../hooks/useOnlineStatus.js'

// Non-blocking banner (R17.8, R17.9). The status region stays mounted so
// screen readers announce the text when it appears.
export default function OfflineIndicator() {
  const online = useOnlineStatus()
  return (
    <div role="status" className="banner-region">
      {!online && (
        <p className="banner offline-banner">You are offline. Everything still works.</p>
      )}
    </div>
  )
}
