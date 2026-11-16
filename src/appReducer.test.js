// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { appReducer, initialState, defaultEditorSettings, needsConfirm } from './appReducer.js'

const KINDS = ['bolt', 'circle', 'flower', 'heart', 'sparkle', 'star']

const photoArb = fc.string({ minLength: 1, maxLength: 6 }).map((s) => `photo-${s}`)
const frameArb = fc.constantFrom(
  { kind: 'design', id: 'dots' },
  { kind: 'design', id: 'solid-#f4ecdd' },
  { kind: 'custom', color: '#123456' },
)
const filterArb = fc.constantFrom('none', 'bw', 'sepia', 'warm', 'cool')

// Actions that build up an arbitrary state starting from a finished session.
const editActionArb = fc.oneof(
  frameArb.map((frame) => ({ type: 'SET_FRAME', frame })),
  filterArb.map((filter) => ({ type: 'SET_FILTER', filter })),
  fc.string({ maxLength: 60 }).map((caption) => ({ type: 'SET_CAPTION', caption })),
  fc.boolean().map((showDate) => ({ type: 'SET_SHOW_DATE', showDate })),
  fc.constantFrom(...KINDS).map((kind) => ({ type: 'STICKER_ADD', kind })),
  fc.record({ x: fc.integer({ min: 0, max: 600 }), y: fc.integer({ min: 0, max: 1800 }) }).map((p) => ({
    type: 'STICKER_MOVE',
    id: 1,
    ...p,
  })),
  fc.constant({ type: 'EXPORTED' }),
  fc.record({ countdownSec: fc.constantFrom(3, 5, 10) }).map((prefs) => ({ type: 'SET_PREFS', prefs })),
)

const editorStateArb = fc
  .tuple(fc.array(photoArb, { minLength: 4, maxLength: 4 }), fc.array(editActionArb, { maxLength: 15 }))
  .map(([photos, actions]) => {
    let s = appReducer(initialState, { type: 'START' })
    s = appReducer(s, { type: 'SESSION_DONE', photos, sessionDate: 1234 })
    for (const a of actions) s = appReducer(s, a)
    return s
  })

describe('appReducer properties', () => {
  // Feature: photobooth-completion, Property 5: Single retake replaces only the selected photo
  it('Property 5: SINGLE_DONE replaces only the selected photo', () => {
    fc.assert(
      fc.property(editorStateArb, fc.integer({ min: 0, max: 3 }), photoArb, (state, index, photo) => {
        const next = appReducer(state, { type: 'SINGLE_DONE', index, photo })
        next.photos.forEach((p, i) => {
          expect(p).toBe(i === index ? photo : state.photos[i])
        })
        expect(next.photos).toHaveLength(4)
        expect(next.sessionDate).toBe(state.sessionDate)
        expect(next.editor).toEqual(state.editor)
        expect(next.prefs).toEqual(state.prefs)
        expect(next.screen).toBe('editor')
      }),
    )
  })

  // Feature: photobooth-completion, Property 6: Cancelling a single retake changes nothing
  it('Property 6: SINGLE_CANCEL keeps photos, date and settings', () => {
    fc.assert(
      fc.property(editorStateArb, fc.integer({ min: 0, max: 3 }), (state, index) => {
        const single = appReducer(state, { type: 'RETAKE_ONE', index })
        expect(single.screen).toBe('capture')
        const next = appReducer(single, { type: 'SINGLE_CANCEL' })
        expect(next.screen).toBe('editor')
        expect(next.photos).toEqual(state.photos)
        expect(next.sessionDate).toBe(state.sessionDate)
        expect(next.editor).toEqual(state.editor)
      }),
    )
  })

  // Feature: photobooth-completion, Property 7: Caption never exceeds 40 characters
  it('Property 7: SET_CAPTION stores a prefix of at most 40 characters', () => {
    fc.assert(
      fc.property(editorStateArb, fc.string({ maxLength: 120 }), (state, caption) => {
        const next = appReducer(state, { type: 'SET_CAPTION', caption })
        expect(next.editor.caption.length).toBeLessThanOrEqual(40)
        expect(caption.startsWith(next.editor.caption)).toBe(true)
        if (caption.length <= 40) expect(next.editor.caption).toBe(caption)
      }),
    )
  })

  // Feature: photobooth-completion, Property 19: Delete removes exactly one sticker
  it('Property 19: STICKER_DELETE removes one sticker, STICKER_CLEAR empties', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...KINDS), { minLength: 1, maxLength: 10 }),
        fc.nat(),
        (kinds, pick) => {
          let s = appReducer(initialState, { type: 'SESSION_DONE', photos: ['a', 'b', 'c', 'd'] })
          for (const kind of kinds) s = appReducer(s, { type: 'STICKER_ADD', kind })
          const before = s.editor.stickers
          if (before.length === 0) return
          const victim = before[pick % before.length]
          const del = appReducer(s, { type: 'STICKER_DELETE', id: victim.id })
          expect(del.editor.stickers).toEqual(before.filter((x) => x.id !== victim.id))
          expect(del.editor.stickers).toHaveLength(before.length - 1)
          const cleared = appReducer(s, { type: 'STICKER_CLEAR' })
          expect(cleared.editor.stickers).toEqual([])
          expect(cleared.editor.selectedId).toBeNull()
        },
      ),
    )
  })

  // Feature: photobooth-completion, Property 20: Sticker count never exceeds 10
  it('Property 20: sticker count never exceeds 10 and add at 10 reports the limit', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...KINDS), { minLength: 1, maxLength: 25 }), (kinds) => {
        let s = appReducer(initialState, { type: 'SESSION_DONE', photos: ['a', 'b', 'c', 'd'] })
        for (const kind of kinds) {
          const before = s
          s = appReducer(s, { type: 'STICKER_ADD', kind })
          expect(s.editor.stickers.length).toBeLessThanOrEqual(10)
          if (before.editor.stickers.length >= 10) {
            expect(s.editor.stickers).toEqual(before.editor.stickers)
            expect(s.notice).toBe('limit')
          }
        }
      }),
    )
  })

  // Feature: photobooth-completion, Property 23: Other edits keep sticker transforms
  it('Property 23: other edits keep the sticker list', () => {
    const otherArb = fc.oneof(
      frameArb.map((frame) => ({ type: 'SET_FRAME', frame })),
      filterArb.map((filter) => ({ type: 'SET_FILTER', filter })),
      fc.string({ maxLength: 60 }).map((caption) => ({ type: 'SET_CAPTION', caption })),
      fc.boolean().map((showDate) => ({ type: 'SET_SHOW_DATE', showDate })),
      fc.tuple(fc.integer({ min: 0, max: 3 }), photoArb).map(([index, photo]) => ({
        type: 'SINGLE_DONE',
        index,
        photo,
      })),
    )
    fc.assert(
      fc.property(editorStateArb, otherArb, (state, action) => {
        const next = appReducer(state, action)
        expect(next.editor.stickers).toEqual(state.editor.stickers)
      }),
    )
  })

  // Feature: photobooth-completion, Property 29: Confirmation guard
  it('Property 29: needsConfirm is true exactly for guarded actions on unsaved state', () => {
    const stateArb = fc.record({ unsaved: fc.boolean(), capturing: fc.boolean() })
    const actionArb = fc.constantFrom(
      'LEAVE',
      'RETAKE_ALL',
      'RELOAD',
      'RETAKE_ONE',
      'DISCARD',
      'START',
      'SET_FRAME',
      'EXPORTED',
    )
    fc.assert(
      fc.property(stateArb, actionArb, (flags, type) => {
        const state = { ...initialState, ...flags }
        const expected =
          type === 'LEAVE' || type === 'RETAKE_ALL'
            ? flags.unsaved
            : type === 'RELOAD'
              ? flags.unsaved || flags.capturing
              : false
        expect(needsConfirm(state, { type })).toBe(expected)
        if (!flags.unsaved && !flags.capturing) expect(needsConfirm(state, { type })).toBe(false)
      }),
    )
  })

  // Feature: photobooth-completion, Property 30: Reset leaves no previous user data
  it('Property 30: DISCARD and RETAKE_ALL reset user data and keep prefs', () => {
    fc.assert(
      fc.property(editorStateArb, fc.constantFrom('DISCARD', 'RETAKE_ALL'), (state, type) => {
        const next = appReducer(state, { type })
        expect(next.photos).toEqual([])
        expect(next.editor.stickers).toEqual([])
        expect(next.editor.caption).toBe('')
        expect(next.editor).toEqual(defaultEditorSettings())
        expect(next.unsaved).toBe(false)
        expect(next.sessionDate).toBeNull()
        expect(next.prefs).toEqual(state.prefs)
      }),
    )
  })
})

describe('appReducer examples', () => {
  it('STICKER_SELECT does not set unsaved', () => {
    let s = appReducer(initialState, { type: 'SESSION_DONE', photos: ['a', 'b', 'c', 'd'] })
    s = appReducer(s, { type: 'STICKER_ADD', kind: 'star' })
    s = appReducer(s, { type: 'EXPORTED' })
    const next = appReducer(s, { type: 'STICKER_SELECT', id: null })
    expect(next.unsaved).toBe(false)
    expect(next.editor.selectedId).toBeNull()
  })

  it('EXPORTED clears unsaved and editor actions set it', () => {
    let s = appReducer(initialState, { type: 'SESSION_DONE', photos: ['a', 'b', 'c', 'd'] })
    s = appReducer(s, { type: 'EXPORTED' })
    expect(s.unsaved).toBe(false)
    expect(appReducer(s, { type: 'SET_FILTER', filter: 'bw' }).unsaved).toBe(true)
  })
})
