const TARGET = 960 / 720 // 4:3

/** Center 4:3 region of a camera frame. Pure. */
export function cropRect(frameW, frameH) {
  let sx = 0
  let sy = 0
  let sw = frameW
  let sh = frameH
  if (frameW / frameH > TARGET) {
    sw = frameH * TARGET
    sx = (frameW - sw) / 2
  } else {
    sh = frameW / TARGET
    sy = (frameH - sh) / 2
  }
  return { sx, sy, sw, sh }
}

/** Mirror unless the track is a rear camera. Missing facingMode counts as user-facing. */
export function isMirrored(trackSettings) {
  return trackSettings?.facingMode !== 'environment'
}
