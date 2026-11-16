// Pure photo filters. Each `apply(pixels)` reads an RGBA array and returns a
// new Uint8ClampedArray of the same length. The input is never mutated and
// alpha bytes are copied unchanged. Uint8ClampedArray rounds and clamps
// results to integers 0..255.

function map(pixels, fn) {
  const out = new Uint8ClampedArray(pixels.length)
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b] = fn(pixels[i], pixels[i + 1], pixels[i + 2])
    out[i] = r
    out[i + 1] = g
    out[i + 2] = b
    out[i + 3] = pixels[i + 3]
  }
  return out
}

function sepiaOf(r, g, b) {
  return [
    r * 0.393 + g * 0.769 + b * 0.189,
    r * 0.349 + g * 0.686 + b * 0.168,
    r * 0.272 + g * 0.534 + b * 0.131,
  ]
}

export const FILTERS = {
  none: {
    label: 'None',
    apply: (pixels) => Uint8ClampedArray.from(pixels),
  },
  bw: {
    label: 'B&W',
    apply: (pixels) =>
      map(pixels, (r, g, b) => {
        const y = r * 0.299 + g * 0.587 + b * 0.114
        return [y, y, y]
      }),
  },
  sepia: {
    label: 'Sepia',
    apply: (pixels) => map(pixels, sepiaOf),
  },
  warm: {
    label: 'Warm',
    apply: (pixels) => map(pixels, (r, g, b) => [r * 1.08 + 8, g, b * 0.88]),
  },
  cool: {
    label: 'Cool',
    apply: (pixels) => map(pixels, (r, g, b) => [r * 0.88, g, b * 1.08 + 8]),
  },
  vintage: {
    label: 'Vintage',
    apply: (pixels) =>
      map(pixels, (r, g, b) => {
        const s = sepiaOf(r, g, b)
        // 60% sepia, 40% original
        const m = [r, g, b].map((v, i) => s[i] * 0.6 + v * 0.4)
        // lower contrast, then a slight green-yellow lift
        const c = m.map((v) => (v - 128) * 0.9 + 128)
        return [c[0] + 6, c[1] + 8, c[2] - 4]
      }),
  },
  contrast: {
    label: 'High Contrast',
    apply: (pixels) =>
      map(pixels, (r, g, b) => [
        (r - 128) * 1.4 + 128,
        (g - 128) * 1.4 + 128,
        (b - 128) * 1.4 + 128,
      ]),
  },
  fade: {
    label: 'Soft Fade',
    apply: (pixels) => map(pixels, (r, g, b) => [r * 0.85 + 38, g * 0.85 + 38, b * 0.85 + 38]),
  },
}
