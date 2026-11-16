import { useCallback, useReducer, useRef, useState } from 'react'
import Landing from './components/Landing'
import Capture from './components/Capture'
import Editor from './components/Editor'
import ConfirmDialog from './components/ConfirmDialog'
import OfflineIndicator from './components/OfflineIndicator'
import UpdatePrompt from './components/UpdatePrompt'
import { appReducer, initialState, needsConfirm } from './appReducer.js'
import { useServiceWorker } from './hooks/useServiceWorker.js'
import { useAppNavigation } from './hooks/useAppNavigation.js'

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  // Remounting Capture aborts a running session (its unmount cleanup aborts).
  const [captureKey, setCaptureKey] = useState(0)
  const abortSession = useCallback(() => setCaptureKey((k) => k + 1), [])

  const nav = useAppNavigation({ state, dispatch, abortSession })

  const onSessionRunning = useCallback(
    (running) => dispatch({ type: 'SESSION_RUNNING', running }),
    [],
  )
  const onPrefs = useCallback(
    (p) => dispatch({ type: 'SET_PREFS', prefs: { countdownSec: p.countdown } }),
    [],
  )
  const captureMode = state.captureMode
  const singleIndex = typeof captureMode === 'object' ? captureMode.single : null
  const captureModeRef = useRef(captureMode)
  captureModeRef.current = captureMode
  const { sessionDone, singleDone } = nav
  const onDone = useCallback(
    (shots) => {
      const m = captureModeRef.current
      if (m && typeof m === 'object') singleDone(m.single, shots[0])
      else sessionDone(shots)
    },
    [sessionDone, singleDone],
  )

  let screen
  if (state.screen === 'capture') {
    screen = (
      <Capture
        key={`${captureKey}-${singleIndex ?? 'full'}`}
        mode={captureMode}
        prefs={{ countdown: state.prefs.countdownSec, deviceId: state.prefs.deviceId }}
        onPrefs={onPrefs}
        onDone={onDone}
        onBack={nav.back}
        onSessionRunning={onSessionRunning}
      />
    )
  } else if (state.screen === 'editor') {
    screen = (
      <Editor
        state={state}
        dispatch={dispatch}
        onRetakeOne={nav.retakeOne}
        onRetakeAll={nav.retakeAll}
      />
    )
  } else {
    screen = <Landing onStart={nav.start} />
  }

  // Update reload goes through the guard (R17.12). It shares the one dialog.
  const { needRefresh, applyUpdate, dismiss } = useServiceWorker()
  const [reloadPending, setReloadPending] = useState(false)
  const requestReload = useCallback(() => {
    if (needsConfirm(state, { type: 'RELOAD' })) setReloadPending(true)
    else applyUpdate()
  }, [state, applyUpdate])
  const confirmReload = useCallback(() => {
    setReloadPending(false)
    applyUpdate()
  }, [applyUpdate])
  const keepReload = useCallback(() => setReloadPending(false), [])

  const leaving = nav.pending === 'leave'
  let dialog
  if (reloadPending) {
    dialog = {
      title: 'Reload now?',
      message: state.capturing
        ? 'A photo session is running. Reloading stops it and discards your photos.'
        : 'Your strip has not been saved. Reloading discards these photos.',
      discardLabel: 'Reload',
      onDiscard: confirmReload,
      onKeep: keepReload,
    }
  } else {
    dialog = {
      title: leaving ? 'Leave without saving?' : 'Retake all photos?',
      message: leaving
        ? 'Your strip has not been saved. If you leave, the photos are gone.'
        : 'Your strip has not been saved. Retaking all discards these photos.',
      discardLabel: leaving ? 'Leave' : 'Retake all',
      onDiscard: nav.confirmDiscard,
      onKeep: nav.keep,
    }
  }
  return (
    <>
      {screen}
      <OfflineIndicator />
      <UpdatePrompt visible={needRefresh} onReload={requestReload} onDismiss={dismiss} />
      <ConfirmDialog open={reloadPending || nav.pending !== null} {...dialog} />
    </>
  )
}
