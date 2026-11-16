import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Editor from './Editor.jsx'
import { defaultEditorSettings } from '../appReducer.js'

// Same mocking approach as Editor.export.test.jsx: no canvas 2D in jsdom.
vi.mock('../lib/renderStrip.js', () => ({ renderStrip: vi.fn() }))
vi.mock('../lib/stickerAssets.js', () => ({
  STICKER_KINDS: [{ kind: 'star', label: 'Star', url: 'star.svg' }],
  stickerLabel: () => 'Star',
  loadStickerImages: () => Promise.resolve({ images: new Map(), failed: [], error: null }),
}))

beforeEach(() => {
  vi.stubGlobal(
    'Image',
    class {
      set src(v) {
        this._src = v
        queueMicrotask(() => this.onload && this.onload())
      }
      get src() {
        return this._src
      }
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    putImageData: vi.fn(),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setup() {
  const state = {
    photos: ['data:a', 'data:b', 'data:c', 'data:d'],
    sessionDate: new Date(2024, 0, 5).getTime(),
    editor: defaultEditorSettings(),
    notice: null,
  }
  render(<Editor state={state} dispatch={vi.fn()} onRetakeOne={vi.fn()} onRetakeAll={vi.fn()} />)
}

function visiblePanels() {
  return screen.getAllByRole('tabpanel', { hidden: true }).filter((p) => !p.hidden)
}

describe('Editor tabs', () => {
  it('moves selection with arrow keys, Home and End and shows only the selected panel', async () => {
    setup()
    const tab = (name) => screen.getByRole('tab', { name })
    expect(tab('Frame')).toHaveAttribute('aria-selected', 'true')
    expect(visiblePanels().map((p) => p.id)).toEqual(['editor-panel-frame'])

    tab('Frame').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(tab('Filter')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Filter')).toHaveFocus()
    expect(visiblePanels().map((p) => p.id)).toEqual(['editor-panel-filter'])

    await userEvent.keyboard('{End}')
    expect(tab('Caption')).toHaveAttribute('aria-selected', 'true')
    expect(visiblePanels().map((p) => p.id)).toEqual(['editor-panel-caption'])

    await userEvent.keyboard('{ArrowRight}') // wraps to first
    expect(tab('Frame')).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{ArrowLeft}') // wraps to last
    expect(tab('Caption')).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{Home}')
    expect(tab('Frame')).toHaveAttribute('aria-selected', 'true')
    expect(visiblePanels()).toHaveLength(1)
  })

  it('keeps the StickerLayer mounted when switching tabs', async () => {
    setup()
    const layer = screen.getByTestId('sticker-layer')
    await userEvent.click(screen.getByRole('tab', { name: 'Stickers' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Caption' }))
    expect(screen.getByTestId('sticker-layer')).toBe(layer)
    expect(layer).toBeInTheDocument()
  })
})
