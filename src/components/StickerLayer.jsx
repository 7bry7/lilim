import { useRef } from 'react'
import { STRIP_W, STRIP_H } from '../lib/layout.js'
import { STICKER_BASE, KEY_STEP, clientToStrip } from '../lib/stickerPlacement.js'
import { stickerLabel } from '../lib/stickerAssets.js'

/**
 * Transparent overlay over the strip canvas. Selection outlines exist only
 * here in the DOM; the canvas never draws them.
 * Props: stickers, selectedId, images (Map kind->Image, optional, for thumbnails),
 * onSelect(id|null), onMove(id,x,y), onScale(id,scale), onRotate(id,deg), onDelete(id).
 */
export default function StickerLayer({
  stickers,
  selectedId,
  onSelect,
  onMove,
  onScale,
  onRotate,
  onDelete,
}) {
  const layerRef = useRef(null)
  const pointers = useRef(new Map()) // pointerId -> {x,y} client
  const gesture = useRef(null)
  // Latest stickers for use inside pointer handlers.
  const latest = useRef(stickers)
  latest.current = stickers

  const rect = () => layerRef.current.getBoundingClientRect()

  function beginGesture(id) {
    const s = latest.current.find((t) => t.id === id)
    if (!s) return
    const pts = [...pointers.current.values()]
    if (pts.length >= 2) {
      const [a, b] = pts
      gesture.current = {
        id,
        mode: 'pinch',
        dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        scale: s.scale,
        rotation: s.rotation,
      }
    } else if (pts.length === 1) {
      const p = clientToStrip(pts[0].x, pts[0].y, rect())
      gesture.current = { id, mode: 'drag', dx: s.x - p.x, dy: s.y - p.y }
    }
  }

  function onPointerDown(e, s) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (selectedId !== s.id) onSelect(s.id)
    beginGesture(s.id)
  }

  function onPointerMove(e, s) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g || g.id !== s.id) return
    if (g.mode === 'drag' && pointers.current.size === 1) {
      const p = clientToStrip(e.clientX, e.clientY, rect())
      onMove(s.id, p.x + g.dx, p.y + g.dy)
    } else if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const angle = Math.atan2(b.y - a.y, b.x - a.x)
      onScale(s.id, g.scale * (dist / g.dist))
      onRotate(s.id, g.rotation + ((angle - g.angle) * 180) / Math.PI)
    }
  }

  function endPointer(e, s) {
    pointers.current.delete(e.pointerId)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    // A remaining finger restarts a drag from its current position.
    if (pointers.current.size > 0) beginGesture(s.id)
    else gesture.current = null
  }

  function onKeyDown(e, s) {
    const step = KEY_STEP
    let handled = true
    switch (e.key) {
      case 'ArrowLeft': onMove(s.id, s.x - step, s.y); break
      case 'ArrowRight': onMove(s.id, s.x + step, s.y); break
      case 'ArrowUp': onMove(s.id, s.x, s.y - step); break
      case 'ArrowDown': onMove(s.id, s.x, s.y + step); break
      case '+':
      case '=': onScale(s.id, s.scale * 1.1); break
      case '-':
      case '_': onScale(s.id, s.scale / 1.1); break
      case 'Delete':
      case 'Backspace': onDelete(s.id); break
      default: handled = false
    }
    if (handled) e.preventDefault()
  }

  return (
    <div
      ref={layerRef}
      data-testid="sticker-layer"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null)
      }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        aspectRatio: `${STRIP_W} / ${STRIP_H}`,
        touchAction: 'none',
        overflow: 'hidden',
      }}
    >
      {stickers.map((s) => {
        const size = STICKER_BASE * s.scale
        const selected = s.id === selectedId
        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            aria-label={`${stickerLabel(s.kind)} sticker${selected ? ', selected' : ''}`}
            aria-pressed={selected}
            onPointerDown={(e) => onPointerDown(e, s)}
            onPointerMove={(e) => onPointerMove(e, s)}
            onPointerUp={(e) => endPointer(e, s)}
            onPointerCancel={(e) => endPointer(e, s)}
            onKeyDown={(e) => onKeyDown(e, s)}
            onFocus={() => !selected && onSelect(s.id)}
            style={{
              position: 'absolute',
              left: `${((s.x - size / 2) / STRIP_W) * 100}%`,
              top: `${((s.y - size / 2) / STRIP_H) * 100}%`,
              width: `${(size / STRIP_W) * 100}%`,
              height: `${(size / STRIP_H) * 100}%`,
              transform: `rotate(${s.rotation}deg)`,
              touchAction: 'none',
              cursor: 'grab',
              background: 'transparent',
              outline: selected ? '2px dashed #3a2a2a' : 'none',
              boxShadow: selected ? '0 0 0 2px #fff' : 'none',
            }}
          />
        )
      })}
    </div>
  )
}
