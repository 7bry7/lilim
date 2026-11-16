// Banner offering an update. Reloading is always user-initiated (R17.10).
export default function UpdatePrompt({ visible, onReload, onDismiss }) {
  if (!visible) return null
  return (
    <div role="status" className="banner update-banner">
      <span>A new version is available.</span>
      <button type="button" className="btn" onClick={onReload}>
        Reload
      </button>
      <button type="button" className="btn ghost" onClick={onDismiss}>
        Later
      </button>
    </div>
  )
}
