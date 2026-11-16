// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { classifyCameraError, CAMERA_MESSAGES } from './cameraErrors.js'
import { nextDeviceId } from './cameraService.js'

const KNOWN = {
  NotAllowedError: 'denied',
  PermissionDeniedError: 'denied',
  NotFoundError: 'not-found',
  DevicesNotFoundError: 'not-found',
  NotReadableError: 'in-use',
  TrackStartError: 'in-use',
  OverconstrainedError: 'overconstrained',
}

describe('Property 3: Camera errors map to a stable code', () => {
  /** **Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.11** */
  it('maps known names to their codes', () => {
    for (const [name, code] of Object.entries(KNOWN)) {
      expect(classifyCameraError({ name })).toBe(code)
    }
  })

  it('maps every other name to unknown', () => {
    const other = fc
      .string()
      .filter((n) => !(n in KNOWN) && !['ConstraintNotSatisfiedError', 'InsecureContextError', 'SecurityError'].includes(n))
    fc.assert(
      fc.property(other, (name) => {
        expect(classifyCameraError({ name })).toBe('unknown')
        expect(classifyCameraError(Object.assign(new Error('x'), { name }))).toBe('unknown')
      }),
    )
  })

  it('is stable for repeated calls on the same input', () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        expect(classifyCameraError({ name })).toBe(classifyCameraError({ name }))
      }),
    )
  })

  it('has a distinct non-empty message for every code', () => {
    const codes = ['denied', 'not-found', 'in-use', 'overconstrained', 'disconnected', 'insecure', 'unknown']
    const texts = codes.map((c) => CAMERA_MESSAGES[c]?.text)
    for (const t of texts) {
      expect(typeof t).toBe('string')
      expect(t.trim().length).toBeGreaterThan(0)
    }
    expect(new Set(texts).size).toBe(codes.length)
  })
})

describe('Property 4: Next camera is cyclic in list order', () => {
  /** **Validates: Requirements 3.7** */
  const devicesArb = fc
    .uniqueArray(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 12 })
    .map((ids) => ids.map((deviceId) => ({ deviceId, kind: 'videoinput' })))

  it('returns the next index modulo length', () => {
    fc.assert(
      fc.property(devicesArb, fc.nat(), (devices, k) => {
        const i = k % devices.length
        expect(nextDeviceId(devices, devices[i].deviceId)).toBe(devices[(i + 1) % devices.length].deviceId)
      }),
    )
  })

  it('returns to the start after list-length applications', () => {
    fc.assert(
      fc.property(devicesArb, fc.nat(), (devices, k) => {
        const start = devices[k % devices.length].deviceId
        let cur = start
        for (let n = 0; n < devices.length; n++) cur = nextDeviceId(devices, cur)
        expect(cur).toBe(start)
      }),
    )
  })

  it('returns undefined for an empty list', () => {
    expect(nextDeviceId([], 'a')).toBeUndefined()
  })
})
