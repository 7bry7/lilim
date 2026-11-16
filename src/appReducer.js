// Pure app state machine. No React, DOM or storage APIs: photos and settings
// live in memory only (R12.1).
import { CAPTION_MAX } from './lib/footerLayout.js'
import {
  MAX_STICKERS,
  placeNew,
  moveTo,
  clampScale,
  clampRotation,
  flipSticker,
} from './lib/stickerPlacement.js'

export const DEFAULT_PREFS = { countdownSec: 3, deviceId: null }

export function defaultEditorSettings() {
  return {
    frame: { kind: 'design', id: 'solid-#f4ecdd' },
    filter: 'none',
    caption: '',
    showDate: true,
    stickers: [],
    selectedId: null,
  }
}

export const initialState = {
  screen: 'landing',
  captureMode: 'full',
  photos: [],
  sessionDate: null,
  editor: defaultEditorSettings(),
  unsaved: false,
  capturing: false,
  prefs: { ...DEFAULT_PREFS },
  nextStickerId: 1,
  // Sticker notice: null | 'limit' | 'no-space'
  notice: null,
}

// Back to an empty capture screen. Keeps prefs and the id counter.
function resetToCapture(state) {
  return {
    ...state,
    screen: 'capture',
    captureMode: 'full',
    photos: [],
    sessionDate: null,
    editor: defaultEditorSettings(),
    unsaved: false,
    capturing: false,
    notice: null,
  }
}

// Apply a change to editor settings and mark the state unsaved.
function edit(state, patch) {
  return { ...state, editor: { ...state.editor, ...patch }, unsaved: true, notice: null }
}

function updateSticker(state, id, fn) {
  const cur = state.editor.stickers.find((s) => s.id === id)
  if (!cur) return state
  const next = fn(cur)
  return edit(state, {
    stickers: state.editor.stickers.map((s) => (s.id === id ? next : s)),
  })
}

export function appReducer(state, action) {
  switch (action.type) {
    case 'START':
      return resetToCapture(state)

    case 'GO_LANDING':
      return { ...resetToCapture(state), screen: 'landing' }

    case 'SESSION_DONE':
      return {
        ...state,
        screen: 'editor',
        captureMode: 'full',
        photos: [...action.photos],
        sessionDate: action.sessionDate ?? Date.now(),
        editor: defaultEditorSettings(),
        unsaved: true,
        capturing: false,
        notice: null,
      }

    case 'SINGLE_DONE': {
      const photos = state.photos.slice()
      photos[action.index] = action.photo
      return {
        ...state,
        screen: 'editor',
        captureMode: 'full',
        photos,
        unsaved: true,
        capturing: false,
      }
    }

    case 'SINGLE_CANCEL':
      return { ...state, screen: 'editor', captureMode: 'full', capturing: false }

    case 'RETAKE_ONE':
      return { ...state, screen: 'capture', captureMode: { single: action.index } }

    case 'RETAKE_ALL':
    case 'DISCARD':
      return resetToCapture(state)

    case 'SET_FRAME':
      return edit(state, { frame: action.frame })

    case 'SET_FILTER':
      return edit(state, { filter: action.filter })

    case 'SET_CAPTION':
      return edit(state, { caption: String(action.caption ?? '').slice(0, CAPTION_MAX) })

    case 'SET_SHOW_DATE':
      return edit(state, { showDate: Boolean(action.showDate) })

    case 'STICKER_ADD': {
      const { stickers } = state.editor
      if (stickers.length >= MAX_STICKERS) return { ...state, notice: 'limit' }
      const placed = placeNew(action.kind, state.nextStickerId)
      if (!placed) return { ...state, notice: 'no-space' }
      return {
        ...edit(state, { stickers: [...stickers, placed], selectedId: placed.id }),
        nextStickerId: state.nextStickerId + 1,
      }
    }

    case 'STICKER_MOVE':
      return updateSticker(state, action.id, (s) => moveTo(s, action.x, action.y))

    case 'STICKER_SCALE':
      return updateSticker(state, action.id, (s) => clampScale(s, action.scale))

    case 'STICKER_ROTATE':
      return updateSticker(state, action.id, (s) => clampRotation(s, action.rotation))

    case 'STICKER_FLIP':
      return updateSticker(state, action.id, flipSticker)

    case 'STICKER_DELETE': {
      if (!state.editor.stickers.some((s) => s.id === action.id)) return state
      return edit(state, {
        stickers: state.editor.stickers.filter((s) => s.id !== action.id),
        selectedId: state.editor.selectedId === action.id ? null : state.editor.selectedId,
      })
    }

    case 'STICKER_CLEAR':
      if (state.editor.stickers.length === 0) return state
      return edit(state, { stickers: [], selectedId: null })

    case 'STICKER_SELECT': {
      // Selection is not part of the exported strip, so it does not set `unsaved`.
      const id = state.editor.stickers.some((s) => s.id === action.id) ? action.id : null
      return { ...state, editor: { ...state.editor, selectedId: id }, notice: null }
    }

    case 'EXPORTED':
      return { ...state, unsaved: false }

    case 'SET_PREFS':
      return { ...state, prefs: { ...state.prefs, ...action.prefs } }

    case 'SESSION_RUNNING':
      return { ...state, capturing: Boolean(action.running) }

    default:
      return state
  }
}

/**
 * True when the action must open the Confirmation_Dialog (R9.4, R9.5, R9.10,
 * R9.11, R17.12). Guarded actions: 'LEAVE' (browser Back from the Editor),
 * 'RETAKE_ALL' and 'RELOAD'. Reload is also guarded while a session runs.
 * Per-photo 'RETAKE_ONE' and every other action never need confirmation.
 */
export function needsConfirm(state, action) {
  switch (action?.type) {
    case 'LEAVE':
    case 'RETAKE_ALL':
      return state.unsaved
    case 'RELOAD':
      return state.unsaved || state.capturing
    default:
      return false
  }
}
