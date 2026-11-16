import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

// Only the service worker registration (a build-time virtual module) is replaced.
// Landing, Capture, Editor and the export code are the real ones.
vi.mock('../hooks/useServiceWorker.js', () => ({
  useServiceWorker: () => ({ needRefresh: false, applyUpdate: () => {}, dismiss: () => {} }),
}))

import App from '../App.jsx'

const root = resolve(__dirname, '..', '..')

// ---------- dynamic flow ----------

let spies
let cookieDescriptor
let anchorClicks
let createdUrls

function fakeStream() {
  const track = {
    getSettings: () => ({ facingMode: 'user' }),
    addEventListener: () => {},
    stop: vi.fn(),
  }
  return { getVideoTracks: () => [track], getTracks: () => [track] }
}

function installEnvironment() {
  // Network and storage spies
  spies = {
    fetch: vi.fn(() => Promise.reject(new Error('network is off'))),
    xhr: vi.fn(),
    idbOpen: vi.fn(),
    beacon: vi.fn(),
    cookieGet: vi.fn(() => ''),
    cookieSet: vi.fn(),
    storage: ['getItem', 'setItem', 'removeItem', 'clear', 'key'].map((m) =>
      vi.spyOn(Storage.prototype, m),
    ),
  }
  vi.stubGlobal('fetch', spies.fetch)
  vi.stubGlobal('XMLHttpRequest', spies.xhr)
  vi.stubGlobal('indexedDB', { open: spies.idbOpen })
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: spies.beacon })
  cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
  Object.defineProperty(Document.prototype, 'cookie', {
    configurable: true,
    get: spies.cookieGet,
    set: spies.cookieSet,
  })

  // Camera
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(() => Promise.resolve(fakeStream())),
      enumerateDevices: vi.fn(() => Promise.resolve([])),
    },
  })
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640)
  vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480)

  // jsdom has no canvas or image decoding
  const ctx = new Proxy(
    {
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      measureText: () => ({ width: 10 }),
    },
    { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA')
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) =>
    cb(new Blob(['png'], { type: 'image/png' })),
  )
  vi.stubGlobal(
    'Image',
    class {
      set src(v) {
        this._src = v
        Promise.resolve().then(() => this.onload?.())
      }
      get src() {
        return this._src
      }
    },
  )

  // File creation: the only way a file can be produced is a Blob URL plus an anchor click
  createdUrls = []
  anchorClicks = []
  URL.createObjectURL = vi.fn((blob) => {
    createdUrls.push(blob)
    return 'blob:lilim-test'
  })
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    anchorClicks.push({ download: this.download, href: this.href })
  })
}

function restoreEnvironment() {
  if (cookieDescriptor) Object.defineProperty(Document.prototype, 'cookie', cookieDescriptor)
  delete navigator.sendBeacon
  delete navigator.mediaDevices
  delete window.isSecureContext
  delete URL.createObjectURL
  delete URL.revokeObjectURL
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
}

const tick = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))

function expectNoNetworkOrStorage() {
  expect(spies.fetch).not.toHaveBeenCalled()
  expect(spies.xhr).not.toHaveBeenCalled()
  expect(spies.beacon).not.toHaveBeenCalled()
  expect(spies.idbOpen).not.toHaveBeenCalled()
  expect(spies.cookieGet).not.toHaveBeenCalled()
  expect(spies.cookieSet).not.toHaveBeenCalled()
  for (const s of spies.storage) expect(s).not.toHaveBeenCalled()
}

describe('privacy: runtime flow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    installEnvironment()
  })
  afterEach(() => {
    cleanup()
    window.history.replaceState(null, '')
    vi.useRealTimers()
    restoreEnvironment()
  })

  // Validates: Requirements 12.1, 12.2, 12.3, 12.5, 17.5
  it('Landing, Capture, Editor and Download use no network or storage and create one file', async () => {
    render(<App />)
    expectNoNetworkOrStorage()

    // Landing -> Capture
    click('Start')
    await tick()
    const start = screen.getByRole('button', { name: 'Start' })
    expect(start).toBeEnabled()

    // Capture: four photos (3 s countdown each plus pauses)
    fireEvent.click(start)
    await tick(20000)

    // Editor: edit a few things
    const download = screen.getByRole('button', { name: 'Download' })
    fireEvent.click(screen.getByRole('tab', { name: 'Caption' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Caption' }), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Filter' }))
    click('Sepia')
    await tick()
    expectNoNetworkOrStorage()

    // Nothing has been written to a file before the click
    expect(createdUrls).toHaveLength(0)
    expect(anchorClicks).toHaveLength(0)

    // Download
    fireEvent.click(download)
    await tick()

    expect(createdUrls).toHaveLength(1)
    expect(anchorClicks).toHaveLength(1)
    expect(anchorClicks[0].download).toMatch(/\.png$/)
    expect(anchorClicks[0].href).toMatch(/^blob:/)
    expectNoNetworkOrStorage()
  })
})

// ---------- static check ----------

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

describe('privacy: static check', () => {
  const files = [...walk(join(root, 'src')), join(root, 'index.html')].filter(
    (f) => !/\.test\.(jsx?|tsx?)$/.test(f) && !/[\\/]src[\\/]test[\\/]/.test(f),
  )
  const text = (f) =>
    // The SVG xmlns attribute is a namespace name, not a request.
    readFileSync(f, 'utf8').replace(/xmlns(:\w+)?="http:\/\/www\.w3\.org\/[^"]*"/g, '')

  it('scans source files', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  // Validates: Requirements 12.1, 12.2, 12.3, 17.5
  it('uses no storage, cookie, network or tracking API', () => {
    const banned =
      /localStorage|sessionStorage|indexedDB|document\.cookie|XMLHttpRequest|\bfetch\s*\(|sendBeacon|WebSocket|EventSource|navigator\.storage|caches\./
    const offenders = files.filter((f) => banned.test(text(f))).map((f) => relative(root, f))
    expect(offenders).toEqual([])
  })

  // Validates: Requirements 12.1, 12.5
  it('contains no external URLs', () => {
    const offenders = files.filter((f) => /(https?:)?\/\/[a-z0-9-]+\.[a-z]{2,}/i.test(text(f).replace(/^\s*\/\/.*$/gm, '')))
    expect(offenders.map((f) => relative(root, f))).toEqual([])
  })
})
