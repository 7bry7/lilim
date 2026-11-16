import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'

// Capture and Editor are replaced by thin stand-ins. The navigation and the
// dialog under test are the real App, useAppNavigation and ConfirmDialog.
const captureMounts = vi.fn()
vi.mock('./components/Capture', async () => {
  const React = await import('react')
  return {
    default: function FakeCapture({ mode, onDone, onBack, onSessionRunning }) {
      React.useEffect(() => {
        captureMounts(mode)
      }, [mode])
      return (
        <div>
          <p>capture screen {typeof mode === 'object' ? `single-${mode.single}` : 'full'}</p>
          <button onClick={onBack}>cap-back</button>
          <button onClick={() => onSessionRunning(true)}>cap-run</button>
          <button onClick={() => onDone(['p0', 'p1', 'p2', 'p3'])}>cap-done</button>
        </div>
      )
    },
  }
})
vi.mock('./components/Editor', () => ({
  default: function FakeEditor({ dispatch, onRetakeOne, onRetakeAll }) {
    return (
      <div>
        <p>editor screen</p>
        <button onClick={() => onRetakeOne(2)}>retake-one</button>
        <button onClick={onRetakeAll}>retake-all</button>
        <button onClick={() => dispatch({ type: 'EXPORTED' })}>mark-saved</button>
      </div>
    )
  },
}))
vi.mock('./hooks/useServiceWorker.js', () => ({
  useServiceWorker: () => ({ needRefresh: false, applyUpdate: () => {}, dismiss: () => {} }),
}))

import App from './App.jsx'

const dialogEl = () => document.querySelector('dialog.confirm-dialog')
const dialogOpen = () => dialogEl().hasAttribute('open')
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))
// Browser Back: history.back() fires popstate asynchronously in jsdom.
const browserBack = async () => {
  const fired = new Promise((r) => window.addEventListener('popstate', r, { once: true }))
  act(() => window.history.back())
  await fired
  await act(async () => {})
}
const toEditor = () => {
  click('Start')
  click('cap-done')
}

describe('App history and confirmation dialog', () => {
  let pushSpy

  beforeEach(() => {
    captureMounts.mockClear()
    pushSpy = vi.spyOn(window.history, 'pushState')
  })
  afterEach(async () => {
    cleanup()
    pushSpy.mockRestore()
    // Return jsdom history to its first entry so tests do not leak position.
    window.history.replaceState(null, '')
  })

  it('pushes one history entry per screen change', () => {
    render(<App />)
    expect(pushSpy).not.toHaveBeenCalled()
    click('Start')
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(pushSpy.mock.calls[0][0]).toMatchObject({ screen: 'capture' })
    click('cap-done')
    expect(pushSpy).toHaveBeenCalledTimes(2)
    expect(pushSpy.mock.calls[1][0]).toMatchObject({ screen: 'editor' })
    expect(screen.getByText('editor screen')).toBeInTheDocument()
  })

  it('Back on an idle Capture returns to Landing without a dialog', async () => {
    render(<App />)
    click('Start')
    await browserBack()
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    expect(dialogOpen()).toBe(false)
  })

  it('Back during a session cancels it and stays on Capture', async () => {
    render(<App />)
    click('Start')
    click('cap-run')
    const mountsBefore = captureMounts.mock.calls.length
    await browserBack()
    expect(screen.getByText('capture screen full')).toBeInTheDocument()
    // Capture was remounted (aborting the session) and a capture entry re-pushed.
    await waitFor(() => expect(captureMounts.mock.calls.length).toBeGreaterThan(mountsBefore))
    expect(pushSpy).toHaveBeenLastCalledWith(expect.objectContaining({ screen: 'capture' }), '')
    expect(dialogOpen()).toBe(false)
  })

  it('Back on an unsaved Editor opens the dialog and stays on the Editor', async () => {
    render(<App />)
    toEditor()
    await browserBack()
    expect(dialogOpen()).toBe(true)
    expect(screen.getByText('Leave without saving?')).toBeInTheDocument()
    expect(screen.getByText('editor screen')).toBeInTheDocument()
  })

  it('Escape acts as Keep', async () => {
    render(<App />)
    toEditor()
    await browserBack()
    expect(dialogOpen()).toBe(true)
    const cancel = new Event('cancel', { cancelable: true })
    act(() => {
      dialogEl().dispatchEvent(cancel)
    })
    expect(cancel.defaultPrevented).toBe(true)
    expect(dialogOpen()).toBe(false)
    expect(screen.getByText('editor screen')).toBeInTheDocument()
  })

  it('Keep closes the dialog and keeps the Editor', async () => {
    render(<App />)
    toEditor()
    await browserBack()
    click('Keep')
    expect(dialogOpen()).toBe(false)
    expect(screen.getByText('editor screen')).toBeInTheDocument()
  })

  it('Discard from the leave dialog returns to a ready Capture', async () => {
    render(<App />)
    toEditor()
    await browserBack()
    click('Leave')
    await act(async () => {})
    await waitFor(() => expect(screen.getByText('capture screen full')).toBeInTheDocument())
    expect(dialogOpen()).toBe(false)
    expect(screen.queryByText('editor screen')).not.toBeInTheDocument()
  })

  it('Retake All on an unsaved Editor asks first; Retake all discards to Capture', async () => {
    render(<App />)
    toEditor()
    click('retake-all')
    expect(dialogOpen()).toBe(true)
    expect(screen.getByText('Retake all photos?')).toBeInTheDocument()
    click('Retake all')
    await waitFor(() => expect(screen.getByText('capture screen full')).toBeInTheDocument())
    expect(dialogOpen()).toBe(false)
  })

  it('saved Editor: Back and Retake All show no dialog and no beforeunload', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    render(<App />)
    toEditor()
    click('mark-saved')
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(false)

    click('retake-all')
    expect(dialogOpen()).toBe(false)
    await waitFor(() => expect(screen.getByText('capture screen full')).toBeInTheDocument())

    cleanup()
    render(<App />)
    toEditor()
    click('mark-saved')
    await browserBack()
    expect(dialogOpen()).toBe(false)
    await waitFor(() => expect(screen.getByText('capture screen full')).toBeInTheDocument())
    add.mockRestore()
  })

  it('beforeunload is prevented only while unsaved', () => {
    render(<App />)
    const idle = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(idle)
    expect(idle.defaultPrevented).toBe(false)

    toEditor()
    const unsaved = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unsaved)
    expect(unsaved.defaultPrevented).toBe(true)

    click('mark-saved')
    const saved = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(saved)
    expect(saved.defaultPrevented).toBe(false)
  })

  it('per-photo Retake opens no dialog and goes to a single-photo Capture', () => {
    render(<App />)
    toEditor()
    click('retake-one')
    expect(dialogOpen()).toBe(false)
    expect(screen.getByText('capture screen single-2')).toBeInTheDocument()
    expect(pushSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ screen: 'capture', mode: { single: 2 } }),
      '',
    )
  })
})
