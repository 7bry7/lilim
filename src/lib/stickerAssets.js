// Bundled sticker set. SVGs are imported as URLs and decoded once.
import starUrl from '../assets/stickers/star.svg?url'
import heartUrl from '../assets/stickers/heart.svg?url'
import circleUrl from '../assets/stickers/circle.svg?url'
import sparkleUrl from '../assets/stickers/sparkle.svg?url'
import flowerUrl from '../assets/stickers/flower.svg?url'
import boltUrl from '../assets/stickers/bolt.svg?url'

export const STICKER_KINDS = [
  { kind: 'star', label: 'Star', url: starUrl },
  { kind: 'heart', label: 'Heart', url: heartUrl },
  { kind: 'circle', label: 'Circle', url: circleUrl },
  { kind: 'sparkle', label: 'Sparkle', url: sparkleUrl },
  { kind: 'flower', label: 'Flower', url: flowerUrl },
  { kind: 'bolt', label: 'Bolt', url: boltUrl },
]

export function stickerLabel(kind) {
  return STICKER_KINDS.find((k) => k.kind === kind)?.label ?? 'Sticker'
}

function decode(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode failed'))
    img.src = url
  })
}

let cached = null

/**
 * Decode every sticker SVG once (the result is cached).
 * Resolves to `{ images: Map<kind, HTMLImageElement>, failed: string[] }`.
 * A sticker that fails to decode is skipped and listed in `failed`;
 * `error` is a user-facing message or null.
 */
export function loadStickerImages() {
  if (!cached) {
    cached = Promise.all(
      STICKER_KINDS.map(async ({ kind, label, url }) => {
        try {
          return { kind, label, img: await decode(url) }
        } catch {
          return { kind, label, img: null }
        }
      }),
    ).then((rows) => {
      const images = new Map(rows.filter((r) => r.img).map((r) => [r.kind, r.img]))
      const failedRows = rows.filter((r) => !r.img)
      return {
        images,
        failed: failedRows.map((r) => r.kind),
        error: failedRows.length
          ? `Could not load sticker${failedRows.length > 1 ? 's' : ''}: ${failedRows.map((r) => r.label).join(', ')}.`
          : null,
      }
    })
  }
  return cached
}
