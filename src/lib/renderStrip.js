import { STRIP_W, STRIP_H, PAD, photoRects } from './layout.js'
import { resolveFrame } from './frames.js'
import { fitCaption, footerLayout, CAPTION_SIZE, DATE_SIZE } from './footerLayout.js'
import { pickTextColor } from './contrast.js'
import { formatDateStamp } from './dateStamp.js'
import { STICKER_BASE } from './stickerPlacement.js'

const FONT_FAMILY = 'system-ui, sans-serif'

function lookupImage(stickerImages, kind) {
  if (!stickerImages) return undefined
  return typeof stickerImages.get === 'function' ? stickerImages.get(kind) : stickerImages[kind]
}

/**
 * Draw the whole strip. Used for both the screen canvas and the export, so
 * there is one code path. Never draws selection outlines or handles.
 * Order: frame, photos (already filtered), footer text, stickers.
 */
export function renderStrip(ctx, { frame, photoCanvases = [], caption = '', showDate = false, sessionDate, stickers = [], stickerImages } = {}) {
  const f = resolveFrame(frame)
  f.paint(ctx, STRIP_W, STRIP_H)

  const rects = photoRects()
  photoCanvases.forEach((src, i) => {
    const r = rects[i]
    if (src && r) ctx.drawImage(src, r.x, r.y, r.w, r.h)
  })

  const hasCaption = Boolean(caption)
  const date = showDate && sessionDate instanceof Date && !Number.isNaN(sessionDate.getTime()) ? sessionDate : null
  const layout = footerLayout({ hasCaption, showDate: Boolean(date) })
  if (layout.caption || layout.date) {
    ctx.fillStyle = pickTextColor(f.footerColors)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const maxWidth = STRIP_W - 2 * PAD
    if (layout.caption) {
      const measure = (text, size) => {
        ctx.font = `${size}px ${FONT_FAMILY}`
        return ctx.measureText(text).width
      }
      const fit = fitCaption(measure, caption, maxWidth, CAPTION_SIZE)
      ctx.font = `${fit.fontSize}px ${FONT_FAMILY}`
      ctx.fillText(fit.text, layout.caption.cx, layout.caption.baselineY)
    }
    if (layout.date) {
      ctx.font = `${DATE_SIZE}px ${FONT_FAMILY}`
      ctx.fillText(formatDateStamp(date), layout.date.cx, layout.date.baselineY)
    }
  }

  // Stickers go last so filters and text never alter sticker pixels.
  for (const s of stickers) {
    const img = lookupImage(stickerImages, s.kind)
    if (!img) continue
    const size = STICKER_BASE * s.scale
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate((s.rotation * Math.PI) / 180)
    ctx.scale(s.flipped ? -1 : 1, 1)
    ctx.drawImage(img, -size / 2, -size / 2, size, size)
    ctx.restore()
  }
}
