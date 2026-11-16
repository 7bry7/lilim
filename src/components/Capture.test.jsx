import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Capture from './Capture.jsx'
import { CAMERA_MESSAGES } from '../lib/cameraErrors.js'

function makeStream() {
  const handlers = {}
  const track = {
    stop: vi.fn(),
    getSettings: () => ({ facingMode: 'user' }),
    addEventListener: (type, fn) => {
      ;(handlers[type] ??= []).push(fn)
    },
    removeEventListener: () => {},
  }
  return {
    track,
    fire: (type) => (handlers[type] ?? []).forEach((fn) => fn()),
    getTracks: () => [track],
    getVideoTracks: () => [track],
  }
}

function domError(name) {
  const e = new Error(name)
  e.name = name
  return e
}

const origMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
const origSecure = Object.getOwnPropertyDescriptor(window, 'isSecureContext')

function setMediaDevices(md) {
  Object.defineProperty(navigator, 'mediaDevices', { value: md, configurable: true, writable: true })
}
function setSecure(v) {
  Object.defineProperty(window, 'isSecureContext', { value: v, configurable: true, writable: true })
}

let getUserMedia
beforeEach(() => {
  getUserMedia = vi.fn()
  setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) })
  setSecure(true)
})
afterEach(() => {
  if (origMediaDevices) Object.defineProperty(navigator, 'mediaDevices', origMediaDevices)
  else delete navigator.mediaDevices
  if (origSecure) Object.defineProperty(window, 'isSecureContext', origSecure)
  else delete window.isSecureContext
  vi.restoreAllMocks()
})

const renderCapture = (props = {}) =>
  render(<Capture mode="full" prefs={{ countdown: 3 }} onDone={vi.fn()} onBack={vi.fn()} {...props} />)

const alertText = () => screen.getByRole('alert').textContent

describe('Capture camera errors', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['NotReadableError', 'in-use'],
  ])('shows a distinct message for %s', async (name, code) => {
    getUserMedia.mockRejectedValue(domError(name))
    renderCapture()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(CAMERA_MESSAGES[code].text)
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeEnabled()
  })

  it('uses a different message for each error type', async () => {
    const texts = []
    for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError']) {
      getUserMedia.mockReset().mockRejectedValue(domError(name))
      const { unmount } = renderCapture()
      await screen.findByRole('alert')
      texts.push(alertText())
      unmount()
    }
    expect(new Set(texts).size).toBe(3)
  })

  it('shows disconnected message when the track fires ended', async () => {
    const s = makeStream()
    getUserMedia.mockResolvedValue(s)
    renderCapture()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled())
    act(() => s.fire('ended'))
    expect(await screen.findByRole('alert')).toHaveTextContent(CAMERA_MESSAGES.disconnected.text)
  })

  it('shows the insecure message without calling getUserMedia', async () => {
    setSecure(false)
    renderCapture()
    expect(await screen.findByRole('alert')).toHaveTextContent(CAMERA_MESSAGES.insecure.text)
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})

describe('Try Again', () => {
  it('sends exactly one request per press', async () => {
    getUserMedia.mockRejectedValue(domError('NotFoundError'))
    renderCapture()
    await screen.findByRole('alert')
    expect(getUserMedia).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    await screen.findByRole('alert')
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('ignores rapid presses while a request is in flight', async () => {
    getUserMedia.mockRejectedValueOnce(domError('NotFoundError'))
    renderCapture()
    await screen.findByRole('alert')

    let resolve
    getUserMedia.mockImplementation(() => new Promise((r) => (resolve = r)))
    const btn = screen.getByRole('button', { name: 'Try Again' })
    act(() => {
      btn.click()
      btn.click()
      btn.click()
    })
    expect(getUserMedia).toHaveBeenCalledTimes(2) // initial + one retry

    await act(async () => resolve(makeStream()))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled())
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('retries once with { video: true } after an OverconstrainedError', async () => {
    getUserMedia
      .mockRejectedValueOnce(domError('OverconstrainedError'))
      .mockResolvedValueOnce(makeStream())
    renderCapture()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled())
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    expect(getUserMedia.mock.calls[1][0]).toEqual({ video: true })
  })

  it('shows the retry error when the { video: true } retry also fails', async () => {
    getUserMedia
      .mockRejectedValueOnce(domError('OverconstrainedError'))
      .mockRejectedValueOnce(domError('NotAllowedError'))
    renderCapture()
    expect(await screen.findByRole('alert')).toHaveTextContent(CAMERA_MESSAGES.denied.text)
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })
})

describe('Cancel', () => {
  it('stops the session, keeps the preview and re-enables Start', async () => {
    const s = makeStream()
    getUserMedia.mockResolvedValue(s)
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640)
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480)
    const onDone = vi.fn()
    const { container } = renderCapture({ onDone })

    const start = await screen.findByRole('button', { name: 'Start' })
    await waitFor(() => expect(start).toBeEnabled())
    fireEvent.click(start)

    const cancel = await screen.findByRole('button', { name: 'Cancel' })
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
    fireEvent.click(cancel)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled())
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(container.querySelector('video')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(s.track.stop).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})
