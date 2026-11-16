// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { fitCaption, footerLayout, CAPTION_SIZE, CAPTION_MIN_SIZE } from './footerLayout.js'
import { FOOTER_RECT } from './layout.js'

// Monotonic in both text length (prefix) and font size.
const makeMeasure = (k) => (text, size) => Array.from(text).length * size * k

describe('Property 10: Caption fitting', () => {
  /** **Validates: Requirements 5.7, 5.8** */
  it('fits at the largest size, or truncates with an ellipsis at the minimum size', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 60 }),
        fc.double({ min: 0.3, max: 1, noNaN: true }),
        fc.integer({ min: 0, max: 2000 }),
        (text, k, extra) => {
          const measure = makeMeasure(k)
          // Wide enough for at least the ellipsis at the minimum size.
          const maxWidth = measure('\u2026', CAPTION_MIN_SIZE) + extra
          const r = fitCaption(measure, text, maxWidth)

          expect(r.fontSize).toBeGreaterThanOrEqual(CAPTION_MIN_SIZE)
          expect(r.fontSize).toBeLessThanOrEqual(CAPTION_SIZE)
          expect(measure(r.text, r.fontSize)).toBeLessThanOrEqual(maxWidth)

          if (r.text === text) {
            if (r.fontSize < CAPTION_SIZE) {
              expect(measure(text, r.fontSize + 1)).toBeGreaterThan(maxWidth)
            }
          } else {
            expect(r.fontSize).toBe(CAPTION_MIN_SIZE)
            expect(r.text.endsWith('\u2026')).toBe(true)
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('keeps short text at full size', () => {
    expect(fitCaption(makeMeasure(0.5), 'hi', 1000)).toEqual({ text: 'hi', fontSize: CAPTION_SIZE })
  })

  it('truncates very long text with an ellipsis', () => {
    const r = fitCaption(makeMeasure(0.5), 'x'.repeat(40), 100)
    expect(r.fontSize).toBe(CAPTION_MIN_SIZE)
    expect(r.text.endsWith('\u2026')).toBe(true)
  })
})

describe('Property 11: Footer layout stays inside the footer without overlap', () => {
  /** **Validates: Requirements 5.2, 5.9, 5.10** */
  it('boxes are inside the footer, centered, non-overlapping, caption above date', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: CAPTION_MIN_SIZE, max: CAPTION_SIZE }),
        (hasCaption, showDate) => {
          const out = footerLayout({ hasCaption, showDate })
          const boxes = [out.caption, out.date].filter(Boolean)

          expect(Boolean(out.caption)).toBe(hasCaption)
          expect(Boolean(out.date)).toBe(showDate)
          if (!hasCaption && !showDate) expect(out).toEqual({})

          for (const b of boxes) {
            expect(b.boxTop).toBeGreaterThanOrEqual(FOOTER_RECT.y)
            expect(b.boxBottom).toBeLessThanOrEqual(FOOTER_RECT.y + FOOTER_RECT.h)
            expect(b.boxBottom).toBeGreaterThan(b.boxTop)
            expect(b.cx).toBe(FOOTER_RECT.x + FOOTER_RECT.w / 2)
            expect(b.baselineY).toBeGreaterThan(b.boxTop)
            expect(b.baselineY).toBeLessThanOrEqual(b.boxBottom)
          }
          if (out.caption && out.date) {
            expect(out.caption.boxBottom).toBeLessThanOrEqual(out.date.boxTop)
          }
        },
      ),
    )
  })
})
