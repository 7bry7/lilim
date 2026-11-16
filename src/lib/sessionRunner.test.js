// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runSession, waitForVideoReady, abortableSleep } from './sessionRunner.js'

describe('runSession', () => {
  const makeCapture = () => {
    let n = 0
    return vi.fn(async () => `photo-${++n}`)
  }

  it('captures 4 photos in order and returns a fresh array', async () => {
    const capture = makeCapture()
    const sleep = vi.fn(async () => {})
    const onShot = vi.fn()
    const photos = await runSession({ shots: 4, countdownSec: 3, capture, sleep, onShot })
    expect(photos).toEqual(['photo-1', 'photo-2', 'photo-3', 'photo-4'])
    expect(onShot.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4])
    expect(capture).toHaveBeenCalledTimes(4)
  })

  it('runs a single shot with no pause after it', async () => {
    const capture = makeCapture()
    const sleep = vi.fn(async () => {})
    const photos = await runSession({ shots: 1, countdownSec: 3, capture, sleep })
    expect(photos).toEqual(['photo-1'])
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 1000, 1000])
  })

  it('counts down from countdownSec then clears before each capture', async () => {
    const counts = []
    const capture = vi.fn(async () => {
      counts.push('capture')
      return 'p'
    })
    await runSession({
      shots: 2,
      countdownSec: 2,
      capture,
      sleep: async () => {},
      onCount: (n) => counts.push(n),
    })
    expect(counts).toEqual([2, 1, null, 'capture', 2, 1, null, 'capture'])
  })

  it('rejects immediately with AbortError when already aborted, without capturing', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const capture = makeCapture()
    await expect(
      runSession({ shots: 4, countdownSec: 3, signal: ctrl.signal, capture, sleep: async () => {} }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(capture).not.toHaveBeenCalled()
  })

  it('drops partial photos and rejects when aborted mid-session', async () => {
    const ctrl = new AbortController()
    const onCount = vi.fn()
    let n = 0
    const capture = vi.fn(async () => {
      n++
      if (n === 2) ctrl.abort()
      return `p${n}`
    })
    let result
    await expect(
      runSession({
        shots: 4,
        countdownSec: 1,
        signal: ctrl.signal,
        capture,
        onCount,
        sleep: async () => {},
      }).then((r) => (result = r)),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(result).toBeUndefined()
    expect(capture).toHaveBeenCalledTimes(2)
    expect(onCount).toHaveBeenLastCalledWith(null)
  })
})

describe('abortableSleep', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('resolves after the delay', async () => {
    const p = abortableSleep(1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(p).resolves.toBeUndefined()
  })

  it('rejects with AbortError when aborted during the sleep', async () => {
    const ctrl = new AbortController()
    const p = abortableSleep(1000, ctrl.signal)
    const assertion = expect(p).rejects.toMatchObject({ name: 'AbortError' })
    ctrl.abort()
    await assertion
  })
})

describe('waitForVideoReady', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const makeVideo = () => {
    const target = new EventTarget()
    target.videoWidth = 0
    target.videoHeight = 0
    return target
  }

  it('resolves immediately when dimensions are already non-zero', async () => {
    const v = makeVideo()
    v.videoWidth = 640
    v.videoHeight = 480
    await expect(waitForVideoReady(v)).resolves.toBeUndefined()
  })

  it('waits until the video has non-zero size', async () => {
    const v = makeVideo()
    let settled = false
    const p = waitForVideoReady(v).then(() => (settled = true))
    await vi.advanceTimersByTimeAsync(1000)
    expect(settled).toBe(false)
    v.videoWidth = 640
    v.videoHeight = 480
    v.dispatchEvent(new Event('loadedmetadata'))
    await p
    expect(settled).toBe(true)
  })

  it('rejects with timeout after 5 s if size stays zero', async () => {
    const v = makeVideo()
    const assertion = expect(waitForVideoReady(v)).rejects.toThrow('timeout')
    await vi.advanceTimersByTimeAsync(4999)
    await vi.advanceTimersByTimeAsync(1)
    await assertion
  })

  it('rejects with aborted when the signal aborts', async () => {
    const v = makeVideo()
    const ctrl = new AbortController()
    const assertion = expect(waitForVideoReady(v, { signal: ctrl.signal })).rejects.toThrow('aborted')
    ctrl.abort()
    await assertion
  })
})
