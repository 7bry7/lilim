import { useEffect, useRef, useState } from 'react'

const SHOTS = 4
const COUNTDOWN_FROM = 3
const PHOTO_W = 960 // fixed 4:3 output so every photo has the same size
const PHOTO_H = 720

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default function Capture({ onDone, onBack }) {
  const videoRef = useRef(null)
  const aliveRef = useRef(true) // lets the async loop stop if the user leaves mid-countdown
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [shooting, setShooting] = useState(false)
  const [count, setCount] = useState(null)
  const [flash, setFlash] = useState(false)
  const [taken, setTaken] = useState(0)

  useEffect(() => {
    let stream
    let cancelled = false
    aliveRef.current = true

    // getUserMedia only exists on https or localhost
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available here. Open the site over https.')
      return
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      .then((s) => {
        // StrictMode mounts twice in dev. If we were cleaned up already, release the camera.
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        videoRef.current.srcObject = s
        setReady(true)
      })
      .catch((err) => {
        if (err.name === 'NotAllowedError') {
          setError('Camera permission was denied. Allow it in your browser settings and reload.')
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.')
        } else {
          setError('Could not start the camera.')
        }
      })

    return () => {
      cancelled = true
      aliveRef.current = false
      // Stop the tracks, or the camera light stays on after leaving the screen
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function takePhoto() {
    const video = videoRef.current
    const vw = video.videoWidth
    const vh = video.videoHeight
    const target = PHOTO_W / PHOTO_H

    // Center-crop the camera frame to 4:3. Phones in portrait give 3:4 frames,
    // and this matches what object-fit: cover shows in the preview.
    let sx = 0, sy = 0, sw = vw, sh = vh
    if (vw / vh > target) {
      sw = vh * target
      sx = (vw - sw) / 2
    } else {
      sh = vw / target
      sy = (vh - sh) / 2
    }

    const canvas = document.createElement('canvas')
    canvas.width = PHOTO_W
    canvas.height = PHOTO_H
    const ctx = canvas.getContext('2d')

    // Mirror the saved photo so it matches the mirrored preview people were posing to
    ctx.translate(PHOTO_W, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, PHOTO_W, PHOTO_H)

    // JPEG keeps 4 photos light in memory. The final strip is exported as PNG later.
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  async function startSession() {
    setShooting(true)
    setTaken(0)
    const shots = []

    for (let i = 0; i < SHOTS; i++) {
      for (let n = COUNTDOWN_FROM; n >= 1; n--) {
        setCount(n)
        await sleep(1000)
        if (!aliveRef.current) return
      }
      setCount(null)
      shots.push(takePhoto())
      setTaken(shots.length)

      setFlash(true)
      setTimeout(() => setFlash(false), 150)
      await sleep(700) // short pause so people can reset their pose
      if (!aliveRef.current) return
    }

    onDone(shots)
  }

  if (error) {
    return (
      <main className="screen center">
        <p className="error">{error}</p>
        <button className="btn" onClick={onBack}>Back</button>
      </main>
    )
  }

  return (
    <main className="screen center">
      <div className="camera">
        <video ref={videoRef} autoPlay playsInline muted />
        {count && <div className="countdown">{count}</div>}
        {flash && <div className="flash" />}
      </div>

      <p className="status">
        {shooting ? `Photo ${Math.min(taken + 1, SHOTS)} of ${SHOTS}` : 'Ready when you are'}
      </p>

      <div className="row">
        <button className="btn ghost" onClick={onBack}>Back</button>
        <button className="btn" onClick={startSession} disabled={!ready || shooting}>
          {shooting ? 'Smile!' : 'Start'}
        </button>
      </div>
    </main>
  )
}