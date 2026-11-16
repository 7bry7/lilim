import { exportFileName } from './fileName.js'
import { printSheetLayout } from './printSheet.js'

export const SHEET_W = 1200
export const SHEET_H = 1800

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not create image'))
      }, 'image/png')
    } catch (err) {
      reject(err)
    }
  })
}

function clickDownload(blob, name) {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function downloadStrip(canvas, now = new Date()) {
  const blob = await canvasToBlob(canvas)
  clickDownload(blob, exportFileName(now))
}

export async function downloadPrintSheet(canvas, now = new Date()) {
  const sheet = document.createElement('canvas')
  sheet.width = SHEET_W
  sheet.height = SHEET_H
  const ctx = sheet.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SHEET_W, SHEET_H)
  const { x, y, w, h } = printSheetLayout(SHEET_W, SHEET_H, canvas.width, canvas.height)
  ctx.drawImage(canvas, x, y, w, h)
  const blob = await canvasToBlob(sheet)
  clickDownload(blob, exportFileName(now, 'lilim-print'))
}

export function canShareImages(nav) {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false
  try {
    const dummy = new File([new Uint8Array(1)], 'strip.png', { type: 'image/png' })
    return !!nav.canShare({ files: [dummy] })
  } catch {
    return false
  }
}

export async function shareStrip(canvas, nav, now = new Date()) {
  const blob = await canvasToBlob(canvas)
  const file = new File([blob], exportFileName(now), { type: 'image/png' })
  try {
    await nav.share({ files: [file], title: 'Lilim strip' })
    return 'shared'
  } catch (err) {
    if (err && err.name === 'AbortError') return 'dismissed'
    throw err
  }
}
