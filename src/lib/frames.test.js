// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { FRAMES } from './frames.js'
import { contrastRatio, pickTextColor } from './contrast.js'

// Feature: photobooth-completion, Property 12: Footer text is readable on any solid frame color
// **Validates: Requirements 5.11**
describe('Property 12: footer text contrast', () => {
  it('pickTextColor reaches 4.5:1 on any custom solid color', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffff }),
        (n) => {
          const color = '#' + n.toString(16).padStart(6, '0')
          const text = pickTextColor([color])
          expect(contrastRatio(text, color)).toBeGreaterThanOrEqual(4.5)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('every built-in frame has 4.5:1 text contrast on all footerColors', () => {
    for (const frame of FRAMES) {
      const text = pickTextColor(frame.footerColors)
      for (const c of frame.footerColors) {
        expect(
          contrastRatio(text, c),
          `${frame.id}: ${text} on ${c}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
