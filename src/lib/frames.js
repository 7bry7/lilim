// Frame designs painted behind the photos and footer. Calm palette: paper, ink,
// oxblood, forest, navy, mustard, blush. Footer text color is picked per frame
// so every built-in frame reaches 4.5:1 (R5.11).

export const SOLID_COLORS = [
  '#f4ecdd', // paper
  '#1c0f10', // ink
  '#4a1218', // oxblood
  '#1f3a2b', // forest
  '#1b2a41', // navy
  '#d9a93a', // mustard
  '#e9c4c0', // blush
]

// Kept for existing callers (Editor.jsx before its refactor).
export const FRAME_COLORS = SOLID_COLORS

function solid(color) {
  return {
    id: `solid-${color}`,
    label: color,
    kind: 'solid',
    color,
    paint(ctx, w, h) {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, w, h)
    },
    footerColors: [color],
  }
}

function pattern(id, label, base, ink, drawFn) {
  return {
    id,
    label,
    kind: 'pattern',
    paint(ctx, w, h) {
      ctx.fillStyle = base
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = ink
      drawFn(ctx, w, h)
    },
    footerColors: [base, ink],
  }
}

function gradient(id, label, from, to) {
  return {
    id,
    label,
    kind: 'gradient',
    paint(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, from)
      g.addColorStop(1, to)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    },
    footerColors: [from, to],
  }
}

const dots = pattern('dots', 'Dots', '#f4ecdd', '#e9c4c0', (ctx, w, h) => {
  const step = 40
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fill()
    }
  }
})

const stripes = pattern('stripes', 'Stripes', '#f4ecdd', '#e9c4c0', (ctx, w, h) => {
  const step = 40
  for (let y = 0; y < h; y += step * 2) ctx.fillRect(0, y, w, step)
})

const checks = pattern('checks', 'Checks', '#f4ecdd', '#e6d8bc', (ctx, w, h) => {
  const s = 40
  for (let r = 0; r * s < h; r++) {
    for (let c = 0; c * s < w; c++) {
      if ((r + c) % 2 === 0) ctx.fillRect(c * s, r * s, s, s)
    }
  }
})

export const FRAMES = [
  ...SOLID_COLORS.map(solid),
  dots,
  stripes,
  checks,
  gradient('gradient-a', 'Gradient blush', '#e9c4c0', '#f4ecdd'),
  gradient('gradient-b', 'Gradient oxblood', '#4a1218', '#1c0f10'),
  gradient('gradient-c', 'Gradient forest', '#1f3a2b', '#1b2a41'),
]

// Custom picked color: a solid frame that replaces the selected design (R6.3).
export function customFrame(color) {
  return { ...solid(color), id: 'custom', label: 'Custom', kind: 'custom' }
}

// Resolve a frame selection to a frame object. Accepts a frame id, a hex
// color string, or `{ kind: 'custom', color }`.
export function resolveFrame(sel) {
  if (sel && typeof sel === 'object') {
    if (sel.kind === 'custom') return customFrame(sel.color)
    if (typeof sel.paint === 'function') return sel
  }
  if (typeof sel === 'string') {
    const byId = FRAMES.find((f) => f.id === sel)
    if (byId) return byId
    if (sel.startsWith('#')) return customFrame(sel)
  }
  return FRAMES[0]
}
