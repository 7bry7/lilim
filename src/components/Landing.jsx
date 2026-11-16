import { useEffect, useRef, useState } from 'react'

const PART_MS = 500

// Without matchMedia (jsdom, very old browsers) skip the animation.
function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function Landing({ onStart }) {
  const [parting, setParting] = useState(false)
  const busy = useRef(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  function handleStart() {
    if (busy.current) return
    busy.current = true
    if (prefersReducedMotion()) {
      onStart()
      return
    }
    setParting(true)
    timer.current = setTimeout(onStart, PART_MS)
  }

  return (
    <main className={`screen center landing${parting ? ' parting' : ''}`}>
      <div className="landing-curtain left" aria-hidden="true" />
      <div className="landing-curtain right" aria-hidden="true" />
      <div className="landing-content">
        <h1 className="title">Lilim</h1>
        <p className="tagline">4 shots. 1 strip. Just us.</p>
        <p className="tagline landing-privacy">
          Your photos stay on this device. Nothing is uploaded.
        </p>
        <button className="btn" onClick={handleStart} disabled={parting}>Start</button>
      </div>
    </main>
  )
}
