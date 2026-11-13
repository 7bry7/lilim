import { useEffect, useRef, useState } from 'react'

// Photo size must match what Capture.jsx saves (960x720)
const PHOTO_W = 960
const PHOTO_H = 720
const PAD = 60
const GAP = 30
const FOOTER = 200 // empty space at the bottom, where the caption and date go later
const STRIP_W = PHOTO_W + PAD * 2
const STRIP_H = PAD + 4 * PHOTO_H + 3 * GAP + FOOTER

const FRAME_COLORS = [
  '#ffffff', '#111111', '#f8c8d4', '#e8788a', '#f6e3b4',
  '#c8e6c9', '#b8d8f0', '#d9c7f0', '#8b1e3f', '#2f4858',
]

// Each filter edits the pixel array in place. Uint8ClampedArray caps
// values at 0-255 for us, so no manual clamping is needed.
const FILTERS = {
  none: { label: 'None', apply: null },
  bw: {
    label: 'B&W',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
        d[i] = d[i + 1] = d[i + 2] = g
      }
    },
  },
  sepia: {
    label: 'Sepia',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2]
        d[i] = r * 0.393 + g * 0.769 + b * 0.189
        d[i + 1] = r * 0.349 + g * 0.686 + b * 0.168
        d[i + 2] = r * 0.272 + g * 0.534 + b * 0.131
      }
    },
  },
  warm: {
    label: 'Warm',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = d[i] * 1.08 + 8 // a bit more red
        d[i + 2] = d[i + 2] * 0.88 // a bit less blue
      }
    },
  },
}

function drawStrip(canvas, images, frameColor, filterKey) {
  // willReadFrequently keeps getImageData fast since we call it 4x per redraw
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = frameColor
  ctx.fillRect(0, 0, STRIP_W, STRIP_H)

  const applyFilter = FILTERS[filterKey].apply

  images.forEach((img, i) => {
    const y = PAD + i * (PHOTO_H + GAP)
    ctx.drawImage(img, PAD, y, PHOTO_W, PHOTO_H)

    if (applyFilter) {
      // Filter only the photo area so the frame color stays untouched
      const data = ctx.getImageData(PAD, y, PHOTO_W, PHOTO_H)
      applyFilter(data.data)
      ctx.putImageData(data, PAD, y)
    }
  })
}

export default function Editor({ photos, onRetake }) {
  const canvasRef = useRef(null)
  const [images, setImages] = useState([])
  const [frameColor, setFrameColor] = useState(FRAME_COLORS[0])
  const [filter, setFilter] = useState('none')

  // Decode the data URLs once. Redrawing then never waits on image loading.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      photos.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.src = src
          })
      )
    ).then((loaded) => {
      if (!cancelled) setImages(loaded)
    })
    return () => { cancelled = true }
  }, [photos])

  // Redraw whenever the photos, color, or filter change
  useEffect(() => {
    if (images.length === 0) return
    drawStrip(canvasRef.current, images, frameColor, filter)
  }, [images, frameColor, filter])

  function download() {
    // toBlob avoids building a huge base64 string for a 1080x3200 image
    canvasRef.current.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'lilim-strip.png'
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  return (
    <main className="screen center">
      <div className="editor">
        {/* Full-resolution canvas, scaled down by CSS only */}
        <canvas
          ref={canvasRef}
          className="strip-canvas"
          width={STRIP_W}
          height={STRIP_H}
        />

        <div className="controls">
          <section>
            <h2>Frame</h2>
            <div className="swatches">
              {FRAME_COLORS.map((c) => (
                <button
                  key={c}
                  className={`swatch ${c === frameColor ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setFrameColor(c)}
                  aria-label={`Frame color ${c}`}
                />
              ))}
              <input
                type="color"
                className="swatch-picker"
                value={frameColor}
                onChange={(e) => setFrameColor(e.target.value)}
                aria-label="Custom frame color"
              />
            </div>
          </section>

          <section>
            <h2>Filter</h2>
            <div className="chips">
              {Object.entries(FILTERS).map(([key, f]) => (
                <button
                  key={key}
                  className={`chip ${key === filter ? 'active' : ''}`}
                  onClick={() => setFilter(key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          <div className="row">
            <button className="btn ghost" onClick={onRetake}>Retake</button>
            <button className="btn" onClick={download}>Download</button>
          </div>
        </div>
      </div>
    </main>
  )
}