// Pure camera error classification and user-facing messages.

const NAME_TO_CODE = {
  NotAllowedError: 'denied',
  PermissionDeniedError: 'denied',
  NotFoundError: 'not-found',
  DevicesNotFoundError: 'not-found',
  NotReadableError: 'in-use',
  TrackStartError: 'in-use',
  OverconstrainedError: 'overconstrained',
  ConstraintNotSatisfiedError: 'overconstrained',
  InsecureContextError: 'insecure',
  SecurityError: 'insecure',
}

const CODES = ['denied', 'not-found', 'in-use', 'overconstrained', 'disconnected', 'insecure', 'unknown']

/** @returns {'denied'|'not-found'|'in-use'|'overconstrained'|'disconnected'|'insecure'|'unknown'} */
export function classifyCameraError(err) {
  if (typeof err === 'string') return CODES.includes(err) ? err : 'unknown'
  if (!err || typeof err !== 'object') return 'unknown'
  if (CODES.includes(err.code) && err.code !== 'unknown') return err.code
  return NAME_TO_CODE[err.name] ?? 'unknown'
}

export const CAMERA_MESSAGES = {
  denied: {
    text: 'Camera permission was denied. Lilim needs the camera to take photos.',
    steps: [
      'Click the camera or lock icon in the browser address bar, or open the browser site settings.',
      'Find "Camera" in the permissions list for this site.',
      'Change the setting from Block to Allow.',
      'Come back to this page and press Try Again. If the browser asks again, choose Allow.',
    ],
  },
  'not-found': {
    text: 'No camera was found. Connect a camera and press Try Again.',
  },
  'in-use': {
    text: 'The camera is in use by another application. Close the other application and press Try Again.',
  },
  overconstrained: {
    text: 'The camera does not support the requested settings. Press Try Again.',
  },
  disconnected: {
    text: 'The camera was disconnected. Reconnect it and press Try Again.',
  },
  insecure: {
    text: 'The camera needs a secure page. Open this app over HTTPS or on localhost.',
  },
  unknown: {
    text: 'The camera could not be started. Press Try Again.',
  },
}
