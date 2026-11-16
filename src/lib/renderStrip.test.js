import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { renderStrip } from './renderStrip.js'
import { describeStrip } from './describeStrip.js'
import { FRAMES, resolveFrame } from './frames.js'
import { FILTERS } from './filters.js'
import { photoRects, STRIP_W, STRIP_H } from './layout.js'
import { formatDateStamp } from './dateStamp.js'
import { STICKER_BASE } from './stickerPlacement.js'

// Recording 2D context: logs every method call and property assignment.
function makeCtx() {
  const log = []
  const props = {}
  const ctx = new Proxy(
    {},
    {
      get(_t, name) {
        if (name === 'log') return log
        if (name === 'measureText') {
          return (text) => {
            log.push({ op: 'measureText', args: [text], font: props.font })
            return { width: String(text).length * 10 }
          }
        }
        if (name === 'createLinearGradient') {
          return (...args) => {
            log.push({ op: name, args })
            return { addColorStop: (...a) => log.push({ op: 'addColorStop', args: a }) }
          }
        }
        if (name in props) return props[name]
        return (...args) => {
          log.push({ op: name, args })
        }
      },
      set(_t, name, value) {
        props[name] = value
        log.push({ op: 'set', name, value })
        return true
      },
    },
  )
  return ctx
}

const photos = () => Array.from({ length: 4 }, (_, i) => ({ id: `photo-${i}` }))
const run = (opts) => {
  const ctx = makeCtx()
  renderStrip(ctx, opts)
  return ctx.log
}
const ops = (log, op) => log.filter((e) => e.op === op)
const photoDraws = (log, photoList) => log.filter((e) => e.op === 'drawImage' && photoList.includes(e.args[0]))

describe('renderStrip', () => {
  it('draws frame, then photos, then text, then stickers', () => {
    const ps = photos()
    const img = { id: 'sticker-img' }
    const log = run({
      frame: 'solid-#f4ecdd',
      photoCanvases: ps,
      caption: 'Hello',
      showDate: true,
      sessionDate: new Date(2024, 4, 3),
      stickers: [{ kind: 'star', x: 540, y: 3100, scale: 1, rotation: 0, flipped: false }],
      stickerImages: { star: img },
    })
    const frameIdx = log.findIndex((e) => e.op === 'fillRect' && e.args[2] === STRIP_W && e.args[3] === STRIP_H)
    const firstPhoto = log.findIndex((e) => e.op === 'drawImage' && ps.includes(e.args[0]))
    const lastPhoto = log.map((e) => e.op === 'drawImage' && ps.includes(e.args[0])).lastIndexOf(true)
    const firstText = log.findIndex((e) => e.op === 'fillText')
    const lastText = log.map((e) => e.op).lastIndexOf('fillText')
    const stickerIdx = log.findIndex((e) => e.op === 'drawImage' && e.args[0] === img)
    expect(frameIdx).toBeGreaterThanOrEqual(0)
    expect(frameIdx).toBeLessThan(firstPhoto)
    expect(lastPhoto).toBeLessThan(firstText)
    expect(lastText).toBeLessThan(stickerIdx)
    expect(ops(log, 'fillText').map((e) => e.args[0])).toEqual(['Hello', formatDateStamp(new Date(2024, 4, 3))])
  })

  it('draws no text for an empty caption with the date hidden', () => {
    const log = run({ frame: 'dots', photoCanvases: photos(), caption: '', showDate: false, sessionDate: new Date() })
    expect(ops(log, 'fillText')).toHaveLength(0)
  })

  it('draws no date when showDate is true but sessionDate is invalid', () => {
    const log = run({ frame: 'dots', caption: '', showDate: true, sessionDate: new Date(NaN) })
    expect(ops(log, 'fillText')).toHaveLength(0)
  })

  it('draws photos into the four photo rects', () => {
    const ps = photos()
    const log = run({ frame: 'checks', photoCanvases: ps })
    const rects = photoRects()
    expect(photoDraws(log, ps).map((e) => e.args.slice(1))).toEqual(rects.map((r) => [r.x, r.y, r.w, r.h]))
  })

  it('applies translate, rotate, flip and size to stickers and skips unknown kinds', () => {
    const img = { id: 'img' }
    const log = run({
      frame: 'solid-#f4ecdd',
      stickers: [
        { kind: 'heart', x: 100, y: 200, scale: 2, rotation: 90, flipped: true },
        { kind: 'missing', x: 1, y: 1, scale: 1, rotation: 0, flipped: false },
      ],
      stickerImages: new Map([['heart', img]]),
    })
    const size = STICKER_BASE * 2
    expect(ops(log, 'translate')[0].args).toEqual([100, 200])
    expect(ops(log, 'rotate')[0].args[0]).toBeCloseTo(Math.PI / 2)
    expect(ops(log, 'scale')[0].args).toEqual([-1, 1])
    const draws = log.filter((e) => e.op === 'drawImage')
    expect(draws).toHaveLength(1)
    expect(draws[0].args).toEqual([img, -size / 2, -size / 2, size, size])
    expect(ops(log, 'save')).toHaveLength(1)
    expect(ops(log, 'restore')).toHaveLength(1)
  })

  it('never draws selection outlines or handles', () => {
    const log = run({ frame: 'solid-#f4ecdd', photoCanvases: photos(), caption: 'x' })
    expect(ops(log, 'strokeRect')).toHaveLength(0)
    expect(ops(log, 'stroke')).toHaveLength(0)
  })

  it('shrinks a long caption to fit and still draws it', () => {
    const log = run({ frame: 'solid-#f4ecdd', caption: 'x'.repeat(40) })
    const text = ops(log, 'fillText')[0]
    expect(text).toBeDefined()
    const fonts = log.filter((e) => e.op === 'set' && e.name === 'font').map((e) => e.value)
    expect(fonts.length).toBeGreaterThan(0)
  })

  it('paints a custom frame color', () => {
    const log = run({ frame: { kind: 'custom', color: '#123456' } })
    const fill = log.find((e) => e.op === 'set' && e.name === 'fillStyle')
    expect(fill.value).toBe('#123456')
  })

  // Feature: photobooth-completion, Property 13: Frame change does not alter photo areas
  it('Property 13: frame change does not alter photo draw calls, and the frame is drawn first', () => {
    // **Validates: Requirements 6.4**
    const frameArb = fc.oneof(
      fc.constantFrom(...FRAMES.map((f) => f.id)),
      fc.tuple(...Array(3).fill(fc.integer({ min: 0, max: 255 }))).map(([r, g, b]) => ({
        kind: 'custom',
        color: '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''),
      })),
    )
    fc.assert(
      fc.property(frameArb, frameArb, (a, b) => {
        const ps = photos()
        const la = run({ frame: a, photoCanvases: ps })
        const lb = run({ frame: b, photoCanvases: ps })
        expect(photoDraws(la, ps)).toEqual(photoDraws(lb, ps))
        expect(photoDraws(la, ps)).toHaveLength(4)
        for (const log of [la, lb]) {
          const firstDraw = log.findIndex((e) => e.op === 'drawImage')
          const painted = log.findIndex((e) => e.op === 'fillRect' || e.op === 'fillStyle')
          expect(painted).toBeGreaterThanOrEqual(0)
          const lastFramePaint = log.slice(0, firstDraw).some((e) => e.op === 'fillRect')
          expect(lastFramePaint).toBe(true)
        }
      }),
      { numRuns: 100 },
    )
  })
})

describe('describeStrip', () => {
  const frameArb = fc.oneof(
    fc.constantFrom(...FRAMES.map((f) => f.id)),
    fc.constantFrom('#abcdef', '#000000').map((color) => ({ kind: 'custom', color })),
  )
  const stickerArb = fc.record({ kind: fc.constantFrom('star', 'heart') })

  // Feature: photobooth-completion, Property 31: Strip description reflects the state
  it('Property 31: description contains count, filter, frame, caption, date and sticker count', () => {
    // **Validates: Requirements 11.6**
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        fc.constantFrom(...Object.keys(FILTERS)),
        frameArb,
        fc.string({ maxLength: 40 }),
        fc.boolean(),
        fc.date({ min: new Date(2000, 0, 2), max: new Date(2100, 0, 1), noInvalidDate: true }),
        fc.array(stickerArb, { maxLength: 10 }),
        (photoCount, filter, frame, caption, showDate, sessionDate, stickers) => {
          const text = describeStrip({ photoCount, filter, frame, caption, showDate, sessionDate, stickers })
          expect(text).toContain(`${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`)
          expect(text).toContain(FILTERS[filter].label)
          expect(text).toContain(resolveFrame(frame).label)
          expect(text).toContain(caption ? caption : 'no caption')
          expect(text).toContain(showDate ? formatDateStamp(sessionDate) : 'hidden')
          expect(text).toContain(`${stickers.length} ${stickers.length === 1 ? 'sticker' : 'stickers'}`)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('falls back for an unknown filter and missing state', () => {
    expect(describeStrip()).toBe(
      'Photo strip: 0 photos, filter None, frame ' + FRAMES[0].label + ', no caption, date hidden, 0 stickers.',
    )
    expect(describeStrip({ filter: 'bogus' })).toContain('filter None')
  })
})
