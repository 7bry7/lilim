// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { cropRect, isMirrored } from './crop.js'

const EPS = 1e-6

describe('cropRect', () => {
  /**
   * Feature: photobooth-completion, Property 1: Crop rectangle is a centered 4:3 region inside the frame
   * **Validates: Requirements 1.8, 1.9, 1.10, 14.4**
   */
  it('returns a centered 4:3 region inside the frame, maximal on one axis', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8000 }), fc.integer({ min: 1, max: 8000 }), (w, h) => {
        const { sx, sy, sw, sh } = cropRect(w, h)
        expect(sw / sh).toBeCloseTo(4 / 3, 9)
        expect(sx).toBeGreaterThanOrEqual(-EPS)
        expect(sy).toBeGreaterThanOrEqual(-EPS)
        expect(sx + sw).toBeLessThanOrEqual(w + EPS)
        expect(sy + sh).toBeLessThanOrEqual(h + EPS)
        // centered
        expect(sx).toBeCloseTo(w - (sx + sw), 6)
        expect(sy).toBeCloseTo(h - (sy + sh), 6)
        // fills the full frame on at least one axis
        expect(Math.abs(sw - w) < EPS || Math.abs(sh - h) < EPS).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('handles known frames', () => {
    expect(cropRect(1280, 720)).toEqual({ sx: 160, sy: 0, sw: 960, sh: 720 })
    expect(cropRect(960, 720)).toEqual({ sx: 0, sy: 0, sw: 960, sh: 720 })
    const r = cropRect(720, 960)
    expect(r.sx).toBe(0)
    expect(r.sw).toBe(720)
    expect(r.sh).toBeCloseTo(540, 9)
    expect(r.sy).toBeCloseTo(210, 9)
  })
})

describe('isMirrored', () => {
  /**
   * Feature: photobooth-completion, Property 2: Mirroring follows the camera facing mode
   * **Validates: Requirements 3.8**
   */
  it('is false only when facingMode is environment', () => {
    const facing = fc.oneof(
      fc.constantFrom('user', 'environment', 'left', 'right'),
      fc.string(),
      fc.constant(undefined),
    )
    fc.assert(
      fc.property(facing, (facingMode) => {
        expect(isMirrored({ facingMode })).toBe(facingMode !== 'environment')
      }),
      { numRuns: 100 },
    )
  })

  it('treats missing settings as user-facing', () => {
    expect(isMirrored(undefined)).toBe(true)
    expect(isMirrored(null)).toBe(true)
    expect(isMirrored({})).toBe(true)
  })
})
