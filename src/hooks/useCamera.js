import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isCameraAvailable,
  startCamera,
  stopStream,
  listVideoInputs,
  nextDeviceId,
} from '../lib/cameraService.js'
import { classifyCameraError } from '../lib/cameraErrors.js'
import { isMirrored } from '../lib/crop.js'

/**
 * Camera lifecycle hook.
 * status: 'idle' | 'starting' | 'ready' | 'error'
 * error: CameraError code or null
 * `retry` and `switchCamera` are ignored while a request is in flight.
 */
export function useCamera() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [stream, setStream] = useState(null)
  const [videoInputs, setVideoInputs] = useState([])
  const [mirrored, setMirrored] = useState(true)

  const inFlight = useRef(false)
  const streamRef = useRef(null)
  const deviceIdRef = useRef(undefined)
  const unmountedRef = useRef(false)
  const requestIdRef = useRef(0)

  const refreshInputs = useCallback(async () => {
    try {
      const list = await listVideoInputs()
      if (!unmountedRef.current) setVideoInputs(list)
    } catch {
      /* keep previous list */
    }
  }, [])

  const releaseStream = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
  }, [])

  const request = useCallback(
    async (deviceId) => {
      if (inFlight.current) return
      inFlight.current = true
      const id = ++requestIdRef.current
      const stale = () => unmountedRef.current || id !== requestIdRef.current

      releaseStream()
      setStream(null)
      setError(null)
      setStatus('starting')

      try {
        if (!isCameraAvailable()) {
          const e = new Error('Insecure context')
          e.code = 'insecure'
          throw e
        }
        const s = await startCamera({ deviceId })
        if (stale()) {
          stopStream(s)
          return
        }
        streamRef.current = s
        const track = s.getVideoTracks()[0]
        const settings = track?.getSettings?.() ?? {}
        deviceIdRef.current = settings.deviceId ?? deviceId
        for (const t of s.getVideoTracks()) {
          t.addEventListener('ended', () => {
            if (streamRef.current !== s || unmountedRef.current) return
            setError('disconnected')
            setStatus('error')
          })
        }
        setMirrored(isMirrored(settings))
        setStream(s)
        setStatus('ready')
        refreshInputs()
      } catch (err) {
        if (stale()) return
        setError(classifyCameraError(err))
        setStatus('error')
      } finally {
        if (id === requestIdRef.current) inFlight.current = false
      }
    },
    [releaseStream, refreshInputs],
  )

  const start = useCallback(() => request(deviceIdRef.current), [request])

  const retry = useCallback(() => request(deviceIdRef.current), [request])

  const switchCamera = useCallback(() => {
    const next = nextDeviceId(videoInputs, deviceIdRef.current)
    if (next === undefined) return
    return request(next)
  }, [request, videoInputs])

  // Initial request, with a cancelled guard for StrictMode double-mount.
  useEffect(() => {
    let cancelled = false
    unmountedRef.current = false
    if (!cancelled) request(undefined)
    return () => {
      cancelled = true
      unmountedRef.current = true
      requestIdRef.current++
      inFlight.current = false
      releaseStream()
    }
  }, [request, releaseStream])

  // Keep the device list fresh.
  useEffect(() => {
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!md?.addEventListener) return undefined
    refreshInputs()
    md.addEventListener('devicechange', refreshInputs)
    return () => md.removeEventListener('devicechange', refreshInputs)
  }, [refreshInputs])

  return { status, error, stream, videoInputs, mirrored, start, retry, switchCamera }
}
