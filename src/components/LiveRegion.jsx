// Visually hidden polite live region. Screen readers announce `message` when it changes.
const hidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export default function LiveRegion({ message = '' }) {
  return (
    <div aria-live="polite" aria-atomic="true" role="status" style={hidden}>
      {message}
    </div>
  )
}
