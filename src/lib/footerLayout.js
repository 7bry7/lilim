import { FOOTER_RECT } from './layout.js'

export const CAPTION_MAX = 40
export const CAPTION_SIZE = 48
export const CAPTION_MIN_SIZE = 16
export const DATE_SIZE = 32

const CAPTION_BOX_H = 64
const DATE_BOX_H = 44
const LINE_GAP = 8

/**
 * Fit text into maxWidth: shrink the font from size down to min, then truncate with an ellipsis.
 * @param {(text:string, size:number)=>number} measure
 * @returns {{text:string, fontSize:number}}
 */
export function fitCaption(measure, text, maxWidth, size = CAPTION_SIZE, min = CAPTION_MIN_SIZE) {
  let fontSize = size
  while (fontSize > min && measure(text, fontSize) > maxWidth) fontSize -= 1
  if (measure(text, fontSize) <= maxWidth) return { text, fontSize }

  const chars = Array.from(text)
  let lo = 0
  let hi = chars.length
  // Largest prefix length whose text + ellipsis fits.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(chars.slice(0, mid).join('').trimEnd() + '\u2026', fontSize) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return { text: chars.slice(0, lo).join('').trimEnd() + '\u2026', fontSize }
}

function box(top, h) {
  return {
    cx: FOOTER_RECT.x + FOOTER_RECT.w / 2,
    boxTop: top,
    boxBottom: top + h,
    baselineY: top + Math.round(h * 0.75),
  }
}

/** Boxes (canvas px) inside FOOTER_RECT, centered, caption above date, no overlap. */
export function footerLayout({ hasCaption, showDate }) {
  const heights = []
  if (hasCaption) heights.push(CAPTION_BOX_H)
  if (showDate) heights.push(DATE_BOX_H)
  if (!heights.length) return {}

  const total = heights.reduce((a, b) => a + b, 0) + LINE_GAP * (heights.length - 1)
  let top = FOOTER_RECT.y + Math.round((FOOTER_RECT.h - total) / 2)
  const out = {}
  if (hasCaption) {
    out.caption = box(top, CAPTION_BOX_H)
    top += CAPTION_BOX_H + LINE_GAP
  }
  if (showDate) out.date = box(top, DATE_BOX_H)
  return out
}
