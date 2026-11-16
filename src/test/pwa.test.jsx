import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pwa = vi.hoisted(() => ({ opts: null, vitePwaOpts: null }))

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((opts) => {
    pwa.opts = opts
    return pwa.update
  }),
}))
vi.mock('vite-plugin-pwa', () => ({
  VitePWA: (o) => {
    pwa.vitePwaOpts = o
    return []
  },
}))

import { registerSW } from 'virtual:pwa-register'
import OfflineIndicator from '../components/OfflineIndicator.jsx'
import UpdatePrompt from '../components/UpdatePrompt.jsx'
import { useServiceWorker } from '../hooks/useServiceWorker.js'
import { needsConfirm, initialState } from '../appReducer.js'

function setOnLine(value) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

describe('offline indicator (R17.8, R17.9)', () => {
  afterEach(() => setOnLine(true))

  it('shows the banner on offline and removes it on online', () => {
    setOnLine(true)
    render(<OfflineIndicator />)
    expect(screen.queryByText(/you are offline/i)).toBeNull()

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument()

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/you are offline/i)).toBeNull()
  })

  it('shows the banner immediately when mounted while offline', () => {
    setOnLine(false)
    render(<OfflineIndicator />)
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument()
  })
})

describe('update prompt and service worker (R17.10 to R17.16)', () => {
  const secure = Object.getOwnPropertyDescriptor(window, 'isSecureContext')

  beforeEach(() => {
    pwa.opts = null
    pwa.update = vi.fn(() => Promise.resolve())
    registerSW.mockClear()
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  })
  afterEach(() => {
    if (secure) Object.defineProperty(window, 'isSecureContext', secure)
    else delete window.isSecureContext
  })

  function Harness() {
    const { needRefresh, applyUpdate, dismiss } = useServiceWorker()
    return <UpdatePrompt visible={needRefresh} onReload={applyUpdate} onDismiss={dismiss} />
  }

  it('shows on onNeedRefresh and reloads only when Reload is pressed', async () => {
    render(<Harness />)
    expect(screen.queryByText(/new version/i)).toBeNull()

    act(() => pwa.opts.onNeedRefresh())
    expect(screen.getByText(/new version/i)).toBeInTheDocument()
    expect(pwa.update).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(pwa.update).toHaveBeenCalledWith(true)
  })

  it('Later hides the prompt without reloading', async () => {
    render(<Harness />)
    act(() => pwa.opts.onNeedRefresh())
    await userEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByText(/new version/i)).toBeNull()
    expect(pwa.update).not.toHaveBeenCalled()
  })

  it('requires the confirmation dialog for reload when unsaved or capturing', () => {
    const reload = { type: 'RELOAD' }
    expect(needsConfirm({ ...initialState, unsaved: true }, reload)).toBe(true)
    expect(needsConfirm({ ...initialState, capturing: true }, reload)).toBe(true)
    expect(needsConfirm(initialState, reload)).toBe(false)
  })

  it('skips registration when not in a secure context', () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    renderHook(() => useServiceWorker())
    expect(registerSW).not.toHaveBeenCalled()
  })

  it('registers in a secure context', () => {
    renderHook(() => useServiceWorker())
    expect(registerSW).toHaveBeenCalledTimes(1)
  })

  it('swallows registration, update-check and apply failures', async () => {
    const { result } = renderHook(() => useServiceWorker())
    expect(() => pwa.opts.onRegisterError(new Error('x'))).not.toThrow()
    const reg = { update: vi.fn(() => Promise.reject(new Error('offline'))) }
    expect(() => pwa.opts.onRegisteredSW('/sw.js', reg)).not.toThrow()
    await Promise.resolve()

    pwa.update.mockImplementation(() => Promise.reject(new Error('fail')))
    expect(() => result.current.applyUpdate()).not.toThrow()
    pwa.update.mockImplementation(() => {
      throw new Error('sync fail')
    })
    expect(() => result.current.applyUpdate()).not.toThrow()
  })

  it('swallows a registerSW that throws', () => {
    registerSW.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    expect(() => renderHook(() => useServiceWorker())).not.toThrow()
  })
})

describe('manifest smoke test (R17.6, R17.11, R14.11)', () => {
  it('declares the required manifest fields and no runtimeCaching', async () => {
    const { THEME_COLOR } = await import('../../vite.config.js')
    const o = pwa.vitePwaOpts
    const m = o.manifest

    expect(m.name).toBeTruthy()
    expect(m.short_name).toBeTruthy()
    expect(m.display).toBe('standalone')

    const sizes = m.icons.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(m.icons.some((i) => i.purpose?.split(' ').includes('maskable'))).toBe(true)

    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const meta = html.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/i)?.[1]
    expect(m.theme_color).toBe(meta)
    expect(THEME_COLOR).toBe(meta)

    expect(o.workbox?.runtimeCaching).toBeUndefined()
  })
})
