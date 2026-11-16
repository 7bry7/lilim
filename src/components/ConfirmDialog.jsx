import { useEffect, useRef } from 'react'

// Modal confirmation built on the native <dialog>. showModal() traps focus and
// makes the rest of the page inert. Escape fires `cancel`, which acts as Keep.
export default function ConfirmDialog({
  open,
  title = 'Discard your photos?',
  message = 'Your strip has not been saved. If you discard it, the photos are gone.',
  discardLabel = 'Discard',
  keepLabel = 'Keep',
  onDiscard,
  onKeep,
}) {
  const dialogRef = useRef(null)
  const keepRef = useRef(null)

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (open && !dlg.open) {
      dlg.showModal()
      keepRef.current?.focus()
    } else if (!open && dlg.open) {
      dlg.close()
    }
  }, [open])

  const handleCancel = (e) => {
    e.preventDefault() // we close it ourselves through `open`
    onKeep?.()
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onCancel={handleCancel}
    >
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-message">{message}</p>
      <div className="row">
        <button type="button" className="btn ghost" onClick={onDiscard}>
          {discardLabel}
        </button>
        <button type="button" className="btn" ref={keepRef} autoFocus onClick={onKeep}>
          {keepLabel}
        </button>
      </div>
    </dialog>
  )
}
