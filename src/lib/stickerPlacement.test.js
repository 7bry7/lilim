// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { STRIP_W, STRIP_H } from './layout.js'
import {
  SCALE_MIN,
  SCALE_MAX,
  KEY_STEP,
  isValid,
  placeNew,
  moveTo,
  clampScale,
  clampRotation,
  flipSticker,
  clientToStrip,
  stripToClient,
  normalizeAngle,
} from './stickerPlacement.js'

const kindArb = fc.constantFrom('star', 'heart', 'circle', 'sparkle', 'flower', 'bolt')

// Sample positions from regions that are usually valid (footer, side margins,
// anywhere) and keep only transforms that pass isValid.
const unit = fc.double({ min: 0, max: 1, noNaN: true })
const validTransform = fc
  .record({
    id: fc.string(),
    kind: kindArb,
    region: fc.constantFrom('footer', 'left', 'right', 'any'),
    u: unit,
    v: unit,
    scale: fc.double({ min: SCALE_MIN, max: 1.5, noNaN: true }),
    rotation: fc.integer({ min: 0, max: 359 }),
    flipped: fc.boolean(),
  })
  .map(({ region, u, v, ...rest }) => {
    let x = u * STRIP_W
    let y = v * STRIP_H
    if (region === 'footer') y = STRIP_H - 100 + (v - 0.5) * 120
    if (region === 'left') x = u * 60
    if (region === 'right') x = STRIP_W - u * 60
    return { ...rest, x, y }
  })
  .filter(isValid)

const target = fc.double({ min: -500, max: 4000, noNaN: true })

describe('stickerPlacement properties', () => {
  // Feature: photobooth-completion, Property 14: New stickers are placed validly at default settings
  it('Property 14: placeNew gives a valid, default, nearest-to-center sticker', () => {
    fc.assert(
      fc.property(
        kindArb,
        fc.array(fc.tuple(fc.double({ min: 0, max: STRIP_W, noNaN: true }), fc.double({ min: 0, max: STRIP_H, noNaN: true })), { maxLength: 200 }),
        (kind, samples) => {
          const t = placeNew(kind, 'a')
          expect(t).not.toBeNull()
          expect(t.kind).toBe(kind)
          expect(t.scale).toBe(1)
          expect(t.rotation).toBe(0)
          expect(t.flipped).toBe(false)
          expect(isValid(t)).toBe(true)
          const d = (x, y) => (x - STRIP_W / 2) ** 2 + (y - STRIP_H / 2) ** 2
          const best = d(t.x, t.y)
          for (const [x, y] of samples) {
            if (d(x, y) < best - 1e-6) {
              expect(isValid({ ...t, x, y })).toBe(false)
            }
          }
        },
      ),
    )
  })

  // Feature: photobooth-completion, Property 15: Dragging never covers a photo and slides along edges
  it('Property 15: moveTo stays valid and equals a valid target', () => {
    fc.assert(
      fc.property(validTransform, target, target, (t, tx, ty) => {
        const r = moveTo(t, tx, ty)
        expect(isValid(r)).toBe(true)
        if (isValid({ ...t, x: tx, y: ty })) {
          expect(r.x).toBeCloseTo(tx, 6)
          expect(r.y).toBeCloseTo(ty, 6)
        }
      }),
    )
  })

  // Feature: photobooth-completion, Property 16: Resize is clamped to a valid size
  it('Property 16: clampScale is in range, valid, not above the request', () => {
    fc.assert(
      fc.property(validTransform, fc.double({ min: 0.1, max: 4, noNaN: true }), (t, req) => {
        const r = clampScale(t, req)
        expect(r.scale).toBeGreaterThanOrEqual(SCALE_MIN)
        expect(r.scale).toBeLessThanOrEqual(SCALE_MAX)
        expect(isValid(r)).toBe(true)
        expect(r.scale).toBeLessThanOrEqual(Math.max(req, SCALE_MIN) + 1e-9)
        if (req >= SCALE_MIN && req <= SCALE_MAX && isValid({ ...t, scale: req })) {
          expect(r.scale).toBe(req)
        }
      }),
    )
  })

  // Feature: photobooth-completion, Property 17: Rotation is clamped to a valid angle
  it('Property 17: clampRotation gives a valid integer angle 0..359', () => {
    fc.assert(
      fc.property(validTransform, fc.integer({ min: -1000, max: 1000 }), (t, req) => {
        const r = clampRotation(t, req)
        expect(Number.isInteger(r.rotation)).toBe(true)
        expect(r.rotation).toBeGreaterThanOrEqual(0)
        expect(r.rotation).toBeLessThanOrEqual(359)
        expect(isValid(r)).toBe(true)
        const n = normalizeAngle(req)
        if (isValid({ ...t, rotation: n })) {
          expect(r.rotation).toBe(n)
        }
      }),
    )
  })

  // Feature: photobooth-completion, Property 18: Flip is an involution
  it('Property 18: flipping twice restores the sticker', () => {
    fc.assert(
      fc.property(validTransform, (t) => {
        expect(flipSticker(flipSticker(t))).toEqual(t)
        expect(flipSticker(t).flipped).toBe(!t.flipped)
      }),
    )
  })

  // Feature: photobooth-completion, Property 21: Pointer mapping is independent of display scale
  it('Property 21: client/strip mapping round trips and ignores display width', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: 50, max: 2000, noNaN: true }),
        fc.double({ min: 50, max: 2000, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (left, top, w1, w2, fx, fy) => {
          const rect = (w) => ({ left, top, width: w, height: (w * STRIP_H) / STRIP_W })
          const sx = fx * STRIP_W
          const sy = fy * STRIP_H
          const r1 = rect(w1)
          const r2 = rect(w2)
          const c1 = stripToClient(sx, sy, r1)
          const c2 = stripToClient(sx, sy, r2)
          const back = clientToStrip(c1.x, c1.y, r1)
          expect(back.x).toBeCloseTo(sx, 6)
          expect(back.y).toBeCloseTo(sy, 6)
          const back2 = clientToStrip(c2.x, c2.y, r2)
          expect(back2.x).toBeCloseTo(back.x, 6)
          expect(back2.y).toBeCloseTo(back.y, 6)
        },
      ),
    )
  })

  // Feature: photobooth-completion, Property 22: Keyboard moves are small and valid
  it('Property 22: keyboardMove is valid and moves at most 10 px on the pressed axis only', async () => {
    const { keyboardMove } = await import('./stickerPlacement.js')
    const arrow = fc.constantFrom([-KEY_STEP, 0], [KEY_STEP, 0], [0, -KEY_STEP], [0, KEY_STEP])
    fc.assert(
      fc.property(validTransform, arrow, (t, [dx, dy]) => {
        const r = keyboardMove(t, dx, dy)
        expect(isValid(r)).toBe(true)
        expect(Math.abs(r.x - t.x)).toBeLessThanOrEqual(KEY_STEP + 1e-9)
        expect(Math.abs(r.y - t.y)).toBeLessThanOrEqual(KEY_STEP + 1e-9)
        if (dx === 0) expect(r.x).toBe(t.x)
        if (dy === 0) expect(r.y).toBe(t.y)
      }),
    )
  })

  it('keyboardMove caps oversized deltas at 10 px', async () => {
    const { keyboardMove } = await import('./stickerPlacement.js')
    const t = { id: 'a', kind: 'star', x: 540, y: 3130, scale: 0.5, rotation: 0, flipped: false }
    expect(isValid(t)).toBe(true)
    const r = keyboardMove(t, 500, 0)
    expect(r.x - t.x).toBeLessThanOrEqual(KEY_STEP)
  })
})
