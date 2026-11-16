// WCAG 2.x contrast helpers.

function parseHex(hex) {
  let h = String(hex).trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two hex colors, in [1, 21]. */
export function contrastRatio(hexA, hexB) {
  const a = luminance(hexA)
  const b = luminance(hexB)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** '#000000' or '#ffffff', whichever has the best worst-case contrast over colors. */
export function pickTextColor(colors) {
  const list = colors && colors.length ? colors : ['#ffffff']
  const worst = (text) => Math.min(...list.map((c) => contrastRatio(text, c)))
  return worst('#000000') >= worst('#ffffff') ? '#000000' : '#ffffff'
}
