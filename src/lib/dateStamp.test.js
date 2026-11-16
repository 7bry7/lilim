// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { formatDateStamp, parseDateStamp } from './dateStamp.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Valid local dates in years 1000..9999 (day is clamped to the real month length).
const dateArb = fc
  .record({
    year: fc.integer({ min: 1000, max: 9999 }),
    month: fc.integer({ min: 0, max: 11 }),
    day: fc.integer({ min: 1, max: 31 }),
  })
  .map(({ year, month, day }) => {
    const last = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(day, last), 12, 0, 0)
  })

describe('dateStamp', () => {
  it('formats a known date', () => {
    expect(formatDateStamp(new Date(2026, 10, 13))).toBe('Nov 13, 2026')
    expect(parseDateStamp('Nov 13, 2026')).toEqual({ year: 2026, month: 11, day: 13 })
    expect(parseDateStamp('Feb 30, 2026')).toBeNull()
  })

  // Feature: photobooth-completion, Property 8: Date stamp format
  it('Property 8: matches the pattern with English month, no leading zero day, 4-digit year', () => {
    // **Validates: Requirements 5.4, 5.5**
    fc.assert(
      fc.property(dateArb, (date) => {
        const s = formatDateStamp(date)
        expect(s).toMatch(/^[A-Z][a-z]{2} [1-9]\d?, \d{4}$/)
        const m = /^(\w{3}) (\d+), (\d{4})$/.exec(s)
        expect(m[1]).toBe(MONTHS[date.getMonth()])
        expect(m[2]).toBe(String(date.getDate()))
        expect(m[3]).toBe(String(date.getFullYear()))
      }),
      { numRuns: 100 },
    )
  })

  // Feature: photobooth-completion, Property 9: Date stamp round trip
  it('Property 9: parse(format(date)) yields the same year, month and day', () => {
    // **Validates: Requirements 5.6**
    fc.assert(
      fc.property(dateArb, (date) => {
        expect(parseDateStamp(formatDateStamp(date))).toEqual({
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
        })
      }),
      { numRuns: 100 },
    )
  })
})
