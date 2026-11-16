// Strip layout constants and geometry. Single source of truth for the canvas.
export const PHOTO_W = 960
export const PHOTO_H = 720
export const PAD = 60
export const GAP = 30
export const FOOTER = 200
export const STRIP_W = PAD * 2 + PHOTO_W // 1080
export const STRIP_H = PAD + 4 * PHOTO_H + 3 * GAP + FOOTER // 3230

/** @returns {{x:number,y:number,w:number,h:number}[]} the 4 Photo_Areas in strip order */
export function photoRects() {
  return Array.from({ length: 4 }, (_, i) => ({
    x: PAD,
    y: PAD + i * (PHOTO_H + GAP),
    w: PHOTO_W,
    h: PHOTO_H,
  }))
}

export const FOOTER_RECT = { x: 0, y: STRIP_H - FOOTER, w: STRIP_W, h: FOOTER }
