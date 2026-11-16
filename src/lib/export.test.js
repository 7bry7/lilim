// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { exportFileName } from './fileName.js'
import { printSheetLayout } from './printSheet.js'

const EPS = 1e-6

describe('exportFileName', () => {
  // Feature: photobooth-completion, Property 27: Export file name format
  // **Validates: Requirements 8.2**
  it('matches the format and encodes local date/time fields', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(1000, 0, 1), max: new Date(9999, 11, 31), noInvalidDate: true }),
        (date) => {
          const name = exportFileName(date)
          const m = /^lilim-strip-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.png$/.exec(name)
          expect(m).not.toBeNull()
          const [y, mo, d, h, mi, s] = m.slice(1).map(Number)
          expect(y).toBe(date.getFullYear())
          expect(mo).toBe(date.getMonth() + 1)
          expect(d).toBe(date.getDate())
          expect(h).toBe(date.getHours())
          expect(mi).toBe(date.getMinutes())
          expect(s).toBe(date.getSeconds())
        },
      ),
    )
  })

  it('example', () => {
    expect(exportFileName(new Date(2024, 0, 5, 7, 8, 9))).toBe('lilim-strip-20240105-070809.png')
  })
})

describe('printSheetLayout', () => {
  // Feature: photobooth-completion, Property 28: Print sheet layout fits, centers and never crops
  // **Validates: Requirements 8.9**
  it('fits, centers, keeps aspect ratio and is the largest uniform scale', () => {
    const dim = fc.integer({ min: 1, max: 10000 })
    fc.assert(
      fc.property(dim, dim, dim, dim, (sw, sh, tw, th) => {
        const { scale, x, y, w, h } = printSheetLayout(sw, sh, tw, th)
        const tol = EPS * Math.max(sw, sh)
        // inside the sheet
        expect(x).toBeGreaterThanOrEqual(-tol)
        expect(y).toBeGreaterThanOrEqual(-tol)
        expect(x + w).toBeLessThanOrEqual(sw + tol)
        expect(y + h).toBeLessThanOrEqual(sh + tol)
        // aspect ratio
        expect(Math.abs(w / h - tw / th)).toBeLessThanOrEqual(EPS * (tw / th))
        // touches the sheet on at least one axis
        expect(Math.abs(w - sw) <= tol || Math.abs(h - sh) <= tol).toBe(true)
        // centered
        expect(Math.abs(x - (sw - w) / 2)).toBeLessThanOrEqual(tol)
        expect(Math.abs(y - (sh - h) / 2)).toBeLessThanOrEqual(tol)
        // no larger uniform scale fits
        const bigger = scale * (1 + 1e-6)
        expect(tw * bigger > sw || th * bigger > sh).toBe(true)
      }),
    )
  })

  it('example: 1080x3230 strip on 1200x1800 sheet is height limited', () => {
    const r = printSheetLayout(1200, 1800, 1080, 3230)
    expect(r.h).toBeCloseTo(1800)
    expect(r.w).toBeCloseTo(602, 0)
  })
})
