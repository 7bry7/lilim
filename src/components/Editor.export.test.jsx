import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Editor from './Editor.jsx'
import { defaultEditorSettings } from '../appReducer.js'

// jsdom has no canvas 2D. renderStrip and sticker decoding are not under test here.
vi.mock('../lib/renderStrip.js', () => ({ renderStrip: vi.fn() }))
vi.mock('../lib/stickerAssets.js', () => ({
  STICKER_KINDS: [{ kind: 'star', label: 'Star', url: 'star.svg' }],
  stickerLabel: () => 'Star',
  loadStickerImages: () => Promise.resolve({ images: new Map(), failed: [], error: null }),
}))

function makeCtx() {
  return {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    putImageData: vi.fn(),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    fillStyle: '',
  }
}

let blobResult // Blob or null, used by toBlob
let anchorClicks
let getContextReturnsNull

beforeEach(() => {
  blobResult = new Blob(['x'], { type: 'image/png' })
  anchorClicks = []
  getContextReturnsNull = false

  // Images decode instantly.
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

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    // The print sheet canvas is created off-screen with 1200 wide; fail only that one.
    if (getContextReturnsNull && this.width === 1200) return null
    return makeCtx()
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb) {
    cb(blobResult)
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    anchorClicks.push({ href: this.href, download: this.download })
  })
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete navigator.share
  delete navigator.canShare
})

function setup() {
  const state = {
    photos: ['data:a', 'data:b', 'data:c', 'data:d'],
    sessionDate: new Date(2024, 0, 5, 3, 4, 5).getTime(),
    editor: defaultEditorSettings(),
    notice: null,
  }
  const dispatch = vi.fn()
  render(<Editor state={state} dispatch={dispatch} onRetakeOne={vi.fn()} onRetakeAll={vi.fn()} />)
  return { dispatch }
}

describe('Editor export and share', () => {
  it('downloads the strip with a timestamped name and dispatches EXPORTED', async () => {
    const { dispatch } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(anchorClicks).toHaveLength(1))
    expect(anchorClicks[0].download).toMatch(/^lilim-strip-\d{8}-\d{6}\.png$/)
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'EXPORTED' }))
    expect(screen.getByText('Strip downloaded.')).toBeInTheDocument()
  })

  it('shows an error and does not dispatch EXPORTED when the blob is null', async () => {
    blobResult = null
    const { dispatch } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Download failed')
    expect(anchorClicks).toHaveLength(0)
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'EXPORTED' })
  })

  it('hides Share when the browser cannot share files', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
  })

  describe('with Web Share support', () => {
    beforeEach(() => {
      navigator.canShare = vi.fn(() => true)
    })

    it('shares the strip and dispatches EXPORTED', async () => {
      navigator.share = vi.fn(() => Promise.resolve())
      const { dispatch } = setup()
      await userEvent.click(screen.getByRole('button', { name: 'Share' }))
      await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'EXPORTED' }))
      const arg = navigator.share.mock.calls[0][0]
      expect(arg.files[0].type).toBe('image/png')
      expect(screen.getByText('Strip shared.')).toBeInTheDocument()
    })

    it('shows no message and no EXPORTED when the share sheet is dismissed', async () => {
      navigator.share = vi.fn(() => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })))
      const { dispatch } = setup()
      await userEvent.click(screen.getByRole('button', { name: 'Share' }))
      await waitFor(() => expect(navigator.share).toHaveBeenCalled())
      await waitFor(() => expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled())
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByText(/Strip (shared|downloaded)/)).toBeNull()
      expect(dispatch).not.toHaveBeenCalledWith({ type: 'EXPORTED' })
    })

    it('shows the failure message when sharing fails for another reason', async () => {
      navigator.share = vi.fn(() => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })))
      const { dispatch } = setup()
      await userEvent.click(screen.getByRole('button', { name: 'Share' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Sharing failed. Use Download instead.')
      expect(dispatch).not.toHaveBeenCalledWith({ type: 'EXPORTED' })
    })
  })

  it('downloads the print sheet', async () => {
    const { dispatch } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Download Print Sheet' }))
    await waitFor(() => expect(anchorClicks).toHaveLength(1))
    expect(anchorClicks[0].download).toMatch(/^lilim-print-\d{8}-\d{6}\.png$/)
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'EXPORTED' }))
  })

  it('shows the print sheet error when the sheet cannot be drawn', async () => {
    getContextReturnsNull = true
    const { dispatch } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Download Print Sheet' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Print sheet could not be created')
    expect(anchorClicks).toHaveLength(0)
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'EXPORTED' })
  })

  it('shows the print sheet error when the sheet blob is null', async () => {
    blobResult = null
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Download Print Sheet' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Print sheet could not be created')
  })
})

