import { useEffect, useRef, useState } from 'react'
import { PHOTO_W, PHOTO_H, STRIP_W, STRIP_H } from '../lib/layout.js'
import { FILTERS } from '../lib/filters.js'
import { FRAMES, SOLID_COLORS, resolveFrame } from '../lib/frames.js'
import { renderStrip } from '../lib/renderStrip.js'
import { describeStrip } from '../lib/describeStrip.js'
import { CAPTION_MAX } from '../lib/footerLayout.js'
import { loadStickerImages } from '../lib/stickerAssets.js'
import { downloadStrip, downloadPrintSheet, canShareImages, shareStrip } from '../lib/exportService.js'
import LiveRegion from './LiveRegion.jsx'
import StickerLayer from './StickerLayer.jsx'
import StickerControls from './StickerControls.jsx'

const DESIGN_FRAMES = FRAMES.filter((f) => f.kind !== 'solid')

const TABS = [
  { id: 'frame', label: 'Frame' },
  { id: 'filter', label: 'Filter' },
  { id: 'stickers', label: 'Stickers' },
  { id: 'caption', label: 'Caption' },
]

// The reducer stores { kind: 'design', id } or { kind: 'custom', color }.
// resolveFrame wants a frame id string or the custom object.
function frameSelection(frame) {
  return frame?.kind === 'custom' ? frame : frame?.id
}

/**
 * Decode data URLs to images. Images are cached by source so an unchanged
 * photo keeps the same Image object across renders.
 */
function useDecodedImages(photos) {
  const cache = useRef(new Map())
  const [images, setImages] = useState([])

  useEffect(() => {
    let cancelled = false
    const map = cache.current
    Promise.all(
      photos.map((src) => {
        if (map.has(src)) return Promise.resolve(map.get(src))
        return new Promise((resolve) => {
          const img = new Image()
          img.onload = () => {
            map.set(src, img)
            resolve(img)
          }
          img.onerror = () => resolve(null)
          img.src = src
        })
      }),
    ).then((loaded) => {
      if (!cancelled) setImages(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [photos])

  useEffect(() => {
    const map = cache.current
    return () => map.clear()
  }, [])

  return images
}

/**
 * Four offscreen 960x720 canvases holding the filtered photos. A filter change
 * recomputes all four; replacing one photo recomputes only that one. The
 * original images are only read, never modified.
 */
export function useFilteredPhotos(images, filterKey) {
  const canvases = useRef([])
  const done = useRef([]) // per index: { img, filter }
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const list = canvases.current
    const marks = done.current
    return () => {
      // Release pixel memory and image references on unmount.
      list.forEach((c) => {
        if (c) {
          c.width = 0
          c.height = 0
        }
      })
      list.length = 0
      marks.length = 0
    }
  }, [])

  useEffect(() => {
    const filter = FILTERS[filterKey] ?? FILTERS.none
    let changed = false
    images.forEach((img, i) => {
      if (!img) return
      const mark = done.current[i]
      if (mark && mark.img === img && mark.filter === filterKey && canvases.current[i]?.width) return
      const c = canvases.current[i] ?? document.createElement('canvas')
      c.width = PHOTO_W
      c.height = PHOTO_H
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, PHOTO_W, PHOTO_H)
      const data = ctx.getImageData(0, 0, PHOTO_W, PHOTO_H)
      data.data.set(filter.apply(data.data))
      ctx.putImageData(data, 0, 0)
      canvases.current[i] = c
      done.current[i] = { img, filter: filterKey }
      changed = true
    })
    if (changed) setVersion((v) => v + 1)
  }, [images, filterKey])

  return { canvases: canvases.current, version }
}

/**
 * Editor props contract (controlled component):
 *   state          reducer state from appReducer (uses photos, sessionDate, editor, notice)
 *   dispatch       reducer dispatch (SET_FRAME, SET_FILTER, SET_CAPTION, SET_SHOW_DATE,
 *                  STICKER_*, EXPORTED)
 *   onRetakeOne(i) per-photo retake, i in 0..3
 *   onRetakeAll()  full retake (App decides about confirmation)
 */
export default function Editor({ state, dispatch, onRetakeOne, onRetakeAll }) {
  const { photos, sessionDate, editor, notice } = state
  const { frame, filter, caption, showDate, stickers, selectedId } = editor

  const canvasRef = useRef(null)
  const images = useDecodedImages(photos)
  const { canvases, version } = useFilteredPhotos(images, filter)
  const [stickerAssets, setStickerAssets] = useState({ images: null, error: null })
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState('frame')
  const tabRefs = useRef({})

  function onTabKeyDown(e, index) {
    let next = null
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next === null) return
    e.preventDefault()
    const id = TABS[next].id
    setTab(id)
    tabRefs.current[id]?.focus()
  }

  useEffect(() => {
    let cancelled = false
    loadStickerImages().then((r) => {
      if (!cancelled) setStickerAssets({ images: r.images, error: r.error })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const dateObj = sessionDate != null ? new Date(sessionDate) : null
  const selection = frameSelection(frame)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || images.length === 0) return
    // StrictMode's dev-only unmount cleanup zeroes the canvas size; restore it.
    if (canvas.width !== STRIP_W) canvas.width = STRIP_W
    if (canvas.height !== STRIP_H) canvas.height = STRIP_H
    renderStrip(canvas.getContext('2d'), {
      frame: selection,
      photoCanvases: canvases,
      caption,
      showDate,
      sessionDate: dateObj,
      stickers,
      stickerImages: stickerAssets.images,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, images, selection, caption, showDate, sessionDate, stickers, stickerAssets.images])

  // Release the screen canvas backing store too.
  useEffect(() => {
    const canvas = canvasRef.current
    return () => {
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
    }
  }, [])

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const canShare = canShareImages(typeof navigator !== 'undefined' ? navigator : null)

  // The screen canvas holds only the rendered strip; sticker outlines and
  // handles live in the separate StickerLayer, so exports match renderStrip.
  async function runExport(action, successMsg, failMsg) {
    if (busy) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const result = await action(canvasRef.current)
      if (result === 'dismissed') return
      dispatch({ type: 'EXPORTED' })
      setMessage(successMsg)
    } catch {
      setError(failMsg)
    } finally {
      setBusy(false)
    }
  }

  const download = () =>
    runExport((c) => downloadStrip(c), 'Strip downloaded.', 'Download failed. Please try again.')
  const share = () =>
    runExport((c) => shareStrip(c, navigator), 'Strip shared.', 'Sharing failed. Use Download instead.')
  const downloadSheet = () =>
    runExport(
      (c) => downloadPrintSheet(c),
      'Print sheet downloaded.',
      'Print sheet could not be created. Please try again.',
    )

  const label = describeStrip({
    photoCount: photos.length,
    filter,
    frame: selection,
    caption,
    showDate,
    sessionDate: dateObj,
    stickers,
  })
  const customColor = frame?.kind === 'custom' ? frame.color : resolveFrame(selection).color ?? '#ffffff'

  const panelProps = (id) => ({
    role: 'tabpanel',
    id: `editor-panel-${id}`,
    'aria-labelledby': `editor-tab-${id}`,
    hidden: tab !== id,
    className: 'editor-tabpanel',
  })

  return (
    <main className="screen center">
      <div className="editor">
        <div className="editor-stage">
          <div className="strip-wrap editor-strip">
            {/* Full-resolution canvas, scaled down by CSS only */}
            <canvas
              ref={canvasRef}
              className="strip-canvas"
              width={STRIP_W}
              height={STRIP_H}
              role="img"
              aria-label={label}
            />
            <StickerLayer
              stickers={stickers}
              selectedId={selectedId}
              onSelect={(id) => dispatch({ type: 'STICKER_SELECT', id })}
              onMove={(id, x, y) => dispatch({ type: 'STICKER_MOVE', id, x, y })}
              onScale={(id, scale) => dispatch({ type: 'STICKER_SCALE', id, scale })}
              onRotate={(id, rotation) => dispatch({ type: 'STICKER_ROTATE', id, rotation })}
              onDelete={(id) => dispatch({ type: 'STICKER_DELETE', id })}
            />
          </div>
        </div>

        <div className="controls editor-panel">
          <section className="editor-retake">
            <h2>Retake</h2>
            <div className="retake-row">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  className="retake-square"
                  aria-label={`Retake photo ${i + 1}`}
                  onClick={() => onRetakeOne(i)}
                >
                  {i + 1}
                </button>
              ))}
              <button className="btn ghost retake-all" onClick={onRetakeAll}>Retake All</button>
            </div>
          </section>

          <div role="tablist" aria-label="Editor options" className="editor-tabs">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el
                }}
                role="tab"
                id={`editor-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`editor-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                className={`editor-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="editor-panels">
            <div {...panelProps('frame')}>
              <div className="swatches">
                {SOLID_COLORS.map((c) => {
                  const active = frame?.kind === 'design' && frame.id === `solid-${c}`
                  return (
                    <button
                      key={c}
                      className={`swatch ${active ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => dispatch({ type: 'SET_FRAME', frame: { kind: 'design', id: `solid-${c}` } })}
                      aria-label={`Frame color ${c}`}
                      aria-pressed={active}
                    />
                  )
                })}
                <input
                  type="color"
                  className="swatch-picker"
                  value={customColor}
                  onChange={(e) => dispatch({ type: 'SET_FRAME', frame: { kind: 'custom', color: e.target.value } })}
                  aria-label="Custom frame color"
                />
              </div>
              <div className="chips" style={{ marginTop: 10 }}>
                {DESIGN_FRAMES.map((f) => {
                  const active = frame?.kind === 'design' && frame.id === f.id
                  return (
                    <button
                      key={f.id}
                      className={`chip ${active ? 'active' : ''}`}
                      aria-pressed={active}
                      onClick={() => dispatch({ type: 'SET_FRAME', frame: { kind: 'design', id: f.id } })}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div {...panelProps('filter')}>
              <div className="chips">
                {Object.entries(FILTERS).map(([key, f]) => (
                  <button
                    key={key}
                    className={`chip ${key === filter ? 'active' : ''}`}
                    aria-pressed={key === filter}
                    onClick={() => dispatch({ type: 'SET_FILTER', filter: key })}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stays mounted when hidden so sticker state and controls persist */}
            <div {...panelProps('stickers')}>
              <StickerControls
                stickers={stickers}
                selectedId={selectedId}
                notice={notice}
                loadError={stickerAssets.error}
                availableKinds={stickerAssets.images ? [...stickerAssets.images.keys()] : undefined}
                onAdd={(kind) => dispatch({ type: 'STICKER_ADD', kind })}
                onScale={(id, scale) => dispatch({ type: 'STICKER_SCALE', id, scale })}
                onRotate={(id, rotation) => dispatch({ type: 'STICKER_ROTATE', id, rotation })}
                onFlip={(id) => dispatch({ type: 'STICKER_FLIP', id })}
                onDelete={(id) => dispatch({ type: 'STICKER_DELETE', id })}
                onClear={() => dispatch({ type: 'STICKER_CLEAR' })}
              />
            </div>

            <div {...panelProps('caption')}>
              <input
                type="text"
                value={caption}
                maxLength={CAPTION_MAX}
                placeholder="Add a caption"
                aria-label="Caption"
                onChange={(e) => dispatch({ type: 'SET_CAPTION', caption: e.target.value })}
              />
              <label style={{ display: 'block', marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={showDate}
                  onChange={(e) => dispatch({ type: 'SET_SHOW_DATE', showDate: e.target.checked })}
                />{' '}
                Show date
              </label>
            </div>
          </div>

          <div className="editor-actions">
            <LiveRegion message={message} />
            {error && <div role="alert">{error}</div>}
            <div className="row">
              <button className="btn primary" onClick={download} disabled={busy}>Download</button>
              {canShare && (
                <button className="btn ghost" onClick={share} disabled={busy}>Share</button>
              )}
              <button className="btn ghost" onClick={downloadSheet} disabled={busy}>Download Print Sheet</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
