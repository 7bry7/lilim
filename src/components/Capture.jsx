import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera } from '../hooks/useCamera.js'
import { cropRect } from '../lib/crop.js'
import { PHOTO_W, PHOTO_H } from '../lib/layout.js'
import { runSession, waitForVideoReady } from '../lib/sessionRunner.js'
import { CAMERA_MESSAGES } from '../lib/cameraErrors.js'
import LiveRegion from './LiveRegion.jsx'

const FULL_SHOTS = 4
const TIMER_CHOICES = [3, 5, 10]
const DEFAULT_COUNTDOWN = 3

export default function Capture({ mode = 'full', prefs, onPrefs, onDone, onBack, onSessionRunning }) {
  const single = mode && typeof mode === 'object' && Number.isInteger(mode.single)
  const shotsTotal = single ? 1 : FULL_SHOTS
  const countdownSec = TIMER_CHOICES.includes(prefs?.countdown) ? prefs.countdown : DEFAULT_COUNTDOWN

  const { status, error: cameraError, stream, videoInputs, mirrored, retry, switchCamera } = useCamera()

  const videoRef = useRef(null)
  const controllerRef = useRef(null) // one AbortController per session
  const mirroredRef = useRef(mirrored)
  mirroredRef.current = mirrored

  const [localError, setLocalError] = useState(null) // e.g. video never became ready
  const [running, setRunning] = useState(false)
  const [count, setCount] = useState(null)
  const [flash, setFlash] = useState(false)
  const [taken, setTaken] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  const error = cameraError ?? localError
  const pending = status === 'starting'

  // Attach the stream to the video element (the element remounts after an error view)
  useEffect(() => {
    if (!error && videoRef.current) videoRef.current.srcObject = stream ?? null
  }, [stream, error])

  // Report running state to the app shell
  useEffect(() => {
    onSessionRunning?.(running)
  }, [running, onSessionRunning])

  // Stream ended (camera error) while a session runs: stop the session
  useEffect(() => {
    if (cameraError) controllerRef.current?.abort()
  }, [cameraError])

  // Unmount: abort any session and tell the shell it is over
  useEffect(
    () => () => {
      controllerRef.current?.abort()
      onSessionRunning?.(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const takePhoto = useCallback(() => {
    const video = videoRef.current
    const { sx, sy, sw, sh } = cropRect(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = PHOTO_W
    canvas.height = PHOTO_H
    const ctx = canvas.getContext('2d')
    if (mirroredRef.current) {
      // Mirror the saved photo so it matches the mirrored preview
      ctx.translate(PHOTO_W, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, PHOTO_W, PHOTO_H)
    // JPEG keeps photos light in memory. The final strip is exported as PNG later.
    return canvas.toDataURL('image/jpeg', 0.92)
  }, [])

  async function startSession() {
    if (running || status !== 'ready') return
    const controller = new AbortController()
    controllerRef.current = controller
    setRunning(true)
    setTaken(0)
    setLocalError(null)

    try {
      await waitForVideoReady(videoRef.current, { timeoutMs: 5000, signal: controller.signal })
      if (!single) setAnnouncement(`Photo 1 of ${FULL_SHOTS}`)
      const photos = await runSession({
        shots: shotsTotal,
        countdownSec,
        signal: controller.signal,
        capture: takePhoto,
        onCount: (n) => {
          setCount(n)
          if (n !== null) setAnnouncement(String(n))
        },
        onShot: (n) => {
          setTaken(n)
          setFlash(true)
          setTimeout(() => setFlash(false), 120)
          if (n < shotsTotal && !single) setAnnouncement(`Photo ${n + 1} of ${FULL_SHOTS}`)
        },
      })
      if (controllerRef.current === controller) controllerRef.current = null
      setRunning(false)
      onDone(photos)
    } catch (err) {
      setCount(null)
      if (controllerRef.current === controller) controllerRef.current = null
      if (err?.message === 'timeout') setLocalError('unknown')
      setRunning(false)
      setAnnouncement('')
      // AbortError / 'aborted': user cancelled, unmounted or stream ended. Nothing to report here.
    }
  }

  function cancelSession() {
    controllerRef.current?.abort()
  }

  function tryAgain() {
    setLocalError(null)
    retry()
  }

  if (error) {
    const msg = CAMERA_MESSAGES[error] ?? CAMERA_MESSAGES.unknown
    return (
      <main className="screen center capture-screen">
        <div role="alert" className="error panel error-panel capture-error">
          <p>{msg.text}</p>
          {msg.steps && (
            <ol>
              {msg.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
        </div>
        <div className="row capture-bar">
          <button className="btn text" onClick={onBack}>Back</button>
          <button className="btn accent" onClick={tryAgain} disabled={pending}>Try Again</button>
        </div>
      </main>
    )
  }

  const progressNow = Math.min(taken + 1, FULL_SHOTS)
  const progressLabel = `${String(progressNow).padStart(2, '0')} / ${String(FULL_SHOTS).padStart(2, '0')}`

  return (
    <main className="screen center capture-screen">
      <div className="camera capture-frame">
        <video
          ref={videoRef}
          className={mirrored ? 'mirrored' : undefined}
          autoPlay
          playsInline
          muted
        />
        {count && <div className="countdown" aria-hidden="true">{count}</div>}
        {flash && <div className="flash" />}
      </div>

      <LiveRegion message={announcement} />

      {running && !single && (
        <p className="capture-progress" aria-hidden="true">{progressLabel}</p>
      )}
      <p className="status capture-status">
        {running && !single
          ? `Photo ${progressNow} of ${FULL_SHOTS}`
          : running
            ? 'Smile!'
            : 'Ready when you are'}
      </p>

      <div className="row capture-bar">
        <div className="capture-timer">
          <span className="capture-label" id="capture-timer-label">Timer</span>
          <div className="segmented" role="group" aria-labelledby="capture-timer-label">
            {TIMER_CHOICES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === countdownSec}
                aria-label={`${s} seconds`}
                onClick={() => onPrefs?.({ ...prefs, countdown: s })}
                disabled={running}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {videoInputs.length > 1 && (
          <button className="btn ghost" onClick={switchCamera} disabled={running || pending}>
            Switch Camera
          </button>
        )}
      </div>

      <div className="row capture-bar">
        <button className="btn text" onClick={onBack} disabled={running}>Back</button>
        {running && (
          <button className="btn ghost" onClick={cancelSession}>Cancel</button>
        )}
        <button className="btn" onClick={startSession} disabled={status !== 'ready' || running}>
          {running ? 'Smile!' : 'Start'}
        </button>
      </div>
    </main>
  )
}
