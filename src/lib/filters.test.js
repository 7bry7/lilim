// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { FILTERS } from './filters.js'

const KEYS = ['none', 'bw', 'sepia', 'warm', 'cool', 'vintage', 'contrast', 'fade']

const pixelsArb = fc
  .array(fc.oneof({ weight: 3, arbitrary: fc.integer({ min: 0, max: 255 }) }, fc.constantFrom(0, 255)), {
    minLength: 0,
    maxLength: 40,
  })
  .map((a) => Uint8ClampedArray.from(a.slice(0, a.length - (a.length % 4))))

describe('FILTERS', () => {
  it('has the expected keys and labels', () => {
    expect(Object.keys(FILTERS)).toEqual(KEYS)
    for (const k of KEYS) expect(typeof FILTERS[k].label).toBe('string')
  })

  it('none returns an equal copy', () => {
    const src = Uint8ClampedArray.from([1, 2, 3, 4])
    const out = FILTERS.none.apply(src)
    expect(out).not.toBe(src)
    expect(Array.from(out)).toEqual([1, 2, 3, 4])
  })

  it('keeps existing formulas', () => {
    expect(Array.from(FILTERS.warm.apply([100, 100, 100, 255]))).toEqual([116, 100, 88, 255])
    expect(Array.from(FILTERS.bw.apply([255, 0, 0, 255]))).toEqual([76, 76, 76, 255])
  })

  // Property 24. **Validates: Requirements 7.4, 7.5, 7.6, 7.9**
  it('returns a new same-length array, keeps alpha, never mutates input', () => {
    fc.assert(
      fc.property(pixelsArb, fc.constantFrom(...KEYS), (px, key) => {
        const copy = Uint8ClampedArray.from(px)
        const out = FILTERS[key].apply(px)
        expect(out).toBeInstanceOf(Uint8ClampedArray)
        expect(out).not.toBe(px)
        expect(out.length).toBe(px.length)
        expect(Array.from(px)).toEqual(Array.from(copy))
        for (let i = 3; i < px.length; i += 4) expect(out[i]).toBe(px[i])
        for (const v of out) expect(Number.isInteger(v) && v >= 0 && v <= 255).toBe(true)
        expect(Array.from(FILTERS[key].apply(px))).toEqual(Array.from(out))
      }),
    )
  })

  // Property 25. **Validates: Requirements 7.7**
  it('none is the identity', () => {
    fc.assert(
      fc.property(pixelsArb, (px) => {
        expect(Array.from(FILTERS.none.apply(px))).toEqual(Array.from(px))
      }),
    )
  })

  // Property 26. **Validates: Requirements 7.8**
  it('b&w gives equal channels', () => {
    fc.assert(
      fc.property(pixelsArb, (px) => {
        const out = FILTERS.bw.apply(px)
        for (let i = 0; i < out.length; i += 4) {
          expect(out[i]).toBe(out[i + 1])
          expect(out[i + 1]).toBe(out[i + 2])
        }
      }),
    )
  })

  // Property 26. **Validates: Requirements 7.6, 7.8**
  it('b&w is idempotent', () => {
    fc.assert(
      fc.property(pixelsArb, (px) => {
        const once = FILTERS.bw.apply(px)
        expect(Array.from(FILTERS.bw.apply(once))).toEqual(Array.from(once))
      }),
    )
  })
})
