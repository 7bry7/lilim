import { FILTERS } from './filters.js'
import { resolveFrame } from './frames.js'
import { formatDateStamp } from './dateStamp.js'

/**
 * Plain-language text alternative for the strip canvas (R11.6). Pure.
 * @param {{ photoCount?: number, filter?: string, frame?: any, caption?: string,
 *   showDate?: boolean, sessionDate?: Date|null, stickers?: any[] }} state
 * @returns {string}
 */
export function describeStrip(state = {}) {
  const { photoCount = 0, filter = 'none', frame, caption = '', showDate = false, sessionDate, stickers = [] } = state
  const filterLabel = (FILTERS[filter] ?? FILTERS.none).label
  const frameLabel = resolveFrame(frame).label
  const captionText = caption ? `caption "${caption}"` : 'no caption'
  const dateText =
    showDate && sessionDate instanceof Date && !Number.isNaN(sessionDate.getTime())
      ? `date ${formatDateStamp(sessionDate)}`
      : 'date hidden'
  const photos = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`
  const stickerText = `${stickers.length} ${stickers.length === 1 ? 'sticker' : 'stickers'}`
  return `Photo strip: ${photos}, filter ${filterLabel}, frame ${frameLabel}, ${captionText}, ${dateText}, ${stickerText}.`
}
