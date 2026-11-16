// Session runner: countdown + capture loop that can be aborted at any point.

const PAUSE_BETWEEN_SHOTS_MS = 700

function abortError() {
  return new DOMException('Session aborted', 'AbortError')
}

/** Resolves when the video has real dimensions. Rejects with Error('timeout') or Error('aborted'). */
export function waitForVideoReady(video, { timeoutMs = 5000, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'))
      return
    }
    const ready = () => video.videoWidth > 0 && video.videoHeight > 0
    if (ready()) {
      resolve()
      return
    }

    let timer
    let poll
    const events = ['loadedmetadata', 'loadeddata', 'playing', 'resize']

    const cleanup = () => {
      clearTimeout(timer)
      clearInterval(poll)
      events.forEach((e) => video.removeEventListener?.(e, check))
      signal?.removeEventListener('abort', onAbort)
    }
    const check = () => {
      if (ready()) {
        cleanup()
        resolve()
      }
    }
    const onAbort = () => {
      cleanup()
      reject(new Error('aborted'))
    }

    events.forEach((e) => video.addEventListener?.(e, check))
    signal?.addEventListener('abort', onAbort, { once: true })
    poll = setInterval(check, 100)
    timer = setTimeout(() => {
      cleanup()
      reject(new Error('timeout'))
    }, timeoutMs)
  })
}

/** Sleep that rejects immediately with AbortError when the signal aborts. */
export function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Runs `shots` photos, each preceded by a countdown from `countdownSec`.
 * Returns a fresh array of captured photos only when every shot completes.
 * On abort it rejects with AbortError and the partial photos are dropped.
 */
export async function runSession({
  shots,
  countdownSec,
  signal,
  capture,
  onCount,
  onShot,
  sleep = abortableSleep,
}) {
  const photos = []
  const check = () => {
    if (signal?.aborted) throw abortError()
  }

  try {
    check()
    for (let i = 0; i < shots; i++) {
      for (let n = countdownSec; n >= 1; n--) {
        onCount?.(n)
        await sleep(1000, signal)
        check()
      }
      onCount?.(null)
      const photo = await capture()
      check()
      photos.push(photo)
      onShot?.(i + 1, photo)

      if (i < shots - 1) {
        await sleep(PAUSE_BETWEEN_SHOTS_MS, signal)
        check()
      }
    }
  } catch (err) {
    photos.length = 0
    onCount?.(null)
    throw err
  }

  return photos.slice()
}
