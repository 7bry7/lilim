import { classifyCameraError } from './cameraErrors.js'

/** True when the page is a secure context and getUserMedia exists. */
export function isCameraAvailable(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false
  return (
    win.isSecureContext === true &&
    !!win.navigator?.mediaDevices &&
    typeof win.navigator.mediaDevices.getUserMedia === 'function'
  )
}

function buildConstraints(deviceId) {
  const size = { width: { ideal: 1280 }, height: { ideal: 960 } }
  return deviceId
    ? { video: { deviceId: { exact: deviceId }, ...size }, audio: false }
    : { video: { facingMode: 'user', ...size }, audio: false }
}

/**
 * Requests the camera. On OverconstrainedError retries exactly once with
 * { video: true }; if the retry fails, its error is thrown.
 */
export async function startCamera({ deviceId } = {}) {
  const md = navigator.mediaDevices
  try {
    return await md.getUserMedia(buildConstraints(deviceId))
  } catch (err) {
    if (classifyCameraError(err) !== 'overconstrained') throw err
    return await md.getUserMedia({ video: true })
  }
}

export function stopStream(stream) {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}

export async function listVideoInputs() {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  if (!md || typeof md.enumerateDevices !== 'function') return []
  const devices = await md.enumerateDevices()
  return devices.filter((d) => d.kind === 'videoinput')
}

/** Next device id in list order, wrapping to the first. Pure. */
export function nextDeviceId(devices, currentId) {
  if (!devices || devices.length === 0) return undefined
  const i = devices.findIndex((d) => d.deviceId === currentId)
  return devices[(i + 1) % devices.length].deviceId
}
