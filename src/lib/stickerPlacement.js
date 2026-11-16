// Pure sticker geometry. Coordinates are strip canvas pixels.
// A sticker is a square of STICKER_BASE px at scale 1. Its axis-aligned
// bounding box (AABB) is tested against the strip bounds and the 4 Photo_Areas.
import { STRIP_W, STRIP_H, photoRects } from './layout.js'

export const STICKER_BASE = 80
export const MAX_STICKERS = 10
export const SCALE_MIN = 0.25
export const SCALE_MAX = 3
export const KEY_STEP = 10

const RECTS = photoRects().map((r) => ({
  left: r.x,
  right: r.x + r.w,
  top: r.y,
  bottom: r.y + r.h,
}))

/** Half of the AABB side of a sticker with the given scale and rotation. */
export function halfExtent(scale, rotationDeg) {
  const rad = (rotationDeg * Math.PI) / 180
  return ((STICKER_BASE * scale) / 2) * (Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad)))
}

/** Rotation normalized to an integer-free range 0..359 (fractions are kept below 360). */
export function normalizeAngle(deg) {
  const n = ((deg % 360) + 360) % 360
  return n >= 360 ? 0 : n
}

function validAt(x, y, h) {
  if (x < h || x > STRIP_W - h || y < h || y > STRIP_H - h) return false
  for (const r of RECTS) {
    if (x > r.left - h && x < r.right + h && y > r.top - h && y < r.bottom + h) return false
  }
  return true
}

/** True when the sticker is inside the strip and covers no Photo_Area (touching is allowed). */
export function isValid(t) {
  return validAt(t.x, t.y, halfExtent(t.scale, t.rotation))
}

/**
 * New sticker at the valid center nearest to the strip center, default size,
 * rotation 0, no flip. Returns null when no valid position exists.
 */
export function placeNew(kind, id) {
  const scale = 1
  const h = halfExtent(scale, 0)
  const cx = STRIP_W / 2
  const cy = STRIP_H / 2
  const xs = new Set([cx, h, STRIP_W - h])
  const ys = new Set([cy, h, STRIP_H - h])
  for (const r of RECTS) {
    xs.add(r.left - h)
    xs.add(r.right + h)
    ys.add(r.top - h)
    ys.add(r.bottom + h)
  }
  let best = null
  let bestD = Infinity
  for (const x of xs) {
    for (const y of ys) {
      if (!validAt(x, y, h)) continue
      const d = (x - cx) ** 2 + (y - cy) ** 2
      if (d < bestD) {
        bestD = d
        best = { x, y }
      }
    }
  }
  if (!best) return null
  return { id, kind, x: best.x, y: best.y, scale, rotation: 0, flipped: false }
}

// Move along one axis from `from` toward `to`, stopping at the first expanded
// photo edge crossed. `axis` is 'x' or 'y'; `other` is the fixed coordinate.
function slide(axis, from, to, other, h) {
  let pos = to
  for (const r of RECTS) {
    const lo = axis === 'x' ? r.left : r.top
    const hi = axis === 'x' ? r.right : r.bottom
    const oLo = axis === 'x' ? r.top : r.left
    const oHi = axis === 'x' ? r.bottom : r.right
    if (!(other > oLo - h && other < oHi + h)) continue
    if (to > from) {
      const edge = lo - h
      if (from <= edge && pos > edge) pos = edge
    } else if (to < from) {
      const edge = hi + h
      if (from >= edge && pos < edge) pos = edge
    }
  }
  return pos
}

/**
 * Drag: from the last valid transform `prev`, move toward the target, sliding
 * along photo edges. The result never overlaps a Photo_Area.
 */
export function moveTo(prev, targetX, targetY) {
  const h = halfExtent(prev.scale, prev.rotation)
  const tx = Math.min(Math.max(targetX, h), STRIP_W - h)
  const ty = Math.min(Math.max(targetY, h), STRIP_H - h)
  const x = slide('x', prev.x, tx, prev.y, h)
  const y = slide('y', prev.y, ty, x, h)
  return { ...prev, x, y }
}

/** Largest valid scale <= request (within SCALE_MIN..SCALE_MAX) at the current center. */
export function clampScale(t, requestedScale) {
  const req = Math.min(Math.max(requestedScale, SCALE_MIN), SCALE_MAX)
  if (validAt(t.x, t.y, halfExtent(req, t.rotation))) return { ...t, scale: req }
  if (req <= t.scale) return { ...t } // smaller than a valid scale is always valid; defensive
  let lo = t.scale
  let hi = req
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (validAt(t.x, t.y, halfExtent(mid, t.rotation))) lo = mid
    else hi = mid
  }
  return { ...t, scale: lo }
}

/** Walk 1 degree at a time from the current angle toward the request; stop before the first invalid angle. */
export function clampRotation(t, requestedDeg) {
  const target = Math.round(normalizeAngle(requestedDeg)) % 360
  let cur = Math.round(normalizeAngle(t.rotation)) % 360
  if (validAt(t.x, t.y, halfExtent(t.scale, target))) return { ...t, rotation: target }
  const diff = ((target - cur + 540) % 360) - 180 // -180..179, shortest direction
  const dir = diff < 0 ? -1 : 1
  for (let i = 0; i < Math.abs(diff); i++) {
    const next = (cur + dir + 360) % 360
    if (!validAt(t.x, t.y, halfExtent(t.scale, next))) break
    cur = next
  }
  return { ...t, rotation: cur }
}

/** Keyboard move. dx, dy are pixel deltas, each capped at KEY_STEP. Same rules as a drag. */
export function keyboardMove(t, dx, dy) {
  const cap = (v) => Math.max(-KEY_STEP, Math.min(KEY_STEP, v))
  return moveTo(t, t.x + cap(dx), t.y + cap(dy))
}

/** Horizontal mirror. Flipping twice restores the original. */
export function flipSticker(t) {
  return { ...t, flipped: !t.flipped }
}

/** Client (viewport) coordinates to strip canvas coordinates. rect is getBoundingClientRect() of the layer. */
export function clientToStrip(clientX, clientY, rect) {
  return {
    x: ((clientX - rect.left) * STRIP_W) / rect.width,
    y: ((clientY - rect.top) * STRIP_H) / rect.height,
  }
}

/** Inverse of clientToStrip. */
export function stripToClient(x, y, rect) {
  return {
    x: rect.left + (x * rect.width) / STRIP_W,
    y: rect.top + (y * rect.height) / STRIP_H,
  }
}
