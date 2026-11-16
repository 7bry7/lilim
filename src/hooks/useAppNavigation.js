import { useCallback, useEffect, useRef, useState } from 'react'

// Browser history integration (R9). The history stack stays
// landing, capture, editor (+ a capture entry on top for a single retake).
// Returns use history.back() so the stack never grows. `popstate` is the only
// place that reacts to the browser Back button and applies the guards.
//
// Options:
//   state          reducer state (screen, captureMode, unsaved, capturing)
//   dispatch       reducer dispatch
//   abortSession   called when browser Back interrupts a running session
//
// Returns { pending, start, sessionDone, retakeOne, singleDone, back,
//           retakeAll, confirmDiscard, keep }. `pending` is null, 'leave'
// or 'retakeAll' and tells App whether to show the ConfirmDialog.
export function useAppNavigation({ state, dispatch, abortSession }) {
  const [pending, setPending] = useState(null)
  const stateRef = useRef(state)
  const abortRef = useRef(abortSession)
  // Set before a programmatic history.back() so popstate ignores it.
  const skipPopRef = useRef(false)

  useEffect(() => {
    stateRef.current = state
    abortRef.current = abortSession
  })

  const push = useCallback((screen, mode = 'full') => {
    window.history.pushState({ screen, mode }, '')
  }, [])

  const goBack = useCallback(() => {
    skipPopRef.current = true
    window.history.back()
  }, [])

  // Reload keeps no state, so landing is the only valid screen (design).
  useEffect(() => {
    window.history.replaceState({ screen: 'landing', mode: 'full' }, '')
  }, [])

  useEffect(() => {
    const onPop = (e) => {
      if (skipPopRef.current) {
        skipPopRef.current = false
        return
      }
      const cur = stateRef.current
      const target = e.state?.screen ?? 'landing'
      const single = cur.captureMode !== 'full'

      // R9.3: Back during a session cancels it and stays on Capture.
      if (cur.screen === 'capture' && cur.capturing) {
        abortRef.current?.()
        dispatch({ type: 'SESSION_RUNNING', running: false })
        push('capture', cur.captureMode)
        return
      }

      if (cur.screen === 'editor') {
        if (target === 'editor') return
        // R9.4: unsaved Editor. Undo the pop and ask.
        if (cur.unsaved) {
          push('editor')
          setPending('leave')
        } else {
          dispatch({ type: 'DISCARD' })
        }
        return
      }

      if (cur.screen === 'capture') {
        if (target === 'landing') {
          dispatch({ type: 'GO_LANDING' })
        } else if (target === 'editor') {
          if (single) dispatch({ type: 'SINGLE_CANCEL' }) // R9.2
          else window.history.replaceState({ screen: 'capture', mode: 'full' }, '')
        }
        return
      }

      // Landing: Forward to an entry whose state is gone.
      if (target !== 'landing') {
        window.history.replaceState({ screen: 'capture', mode: 'full' }, '')
        dispatch({ type: 'START' })
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [dispatch, push])

  // R9.9, R9.10: attach only while there is something to lose.
  useEffect(() => {
    if (!state.unsaved) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [state.unsaved])

  const start = useCallback(() => {
    dispatch({ type: 'START' })
    push('capture')
  }, [dispatch, push])

  const sessionDone = useCallback(
    (photos, sessionDate) => {
      dispatch({ type: 'SESSION_DONE', photos, sessionDate })
      push('editor')
    },
    [dispatch, push],
  )

  // R9.11: no dialog.
  const retakeOne = useCallback(
    (index) => {
      dispatch({ type: 'RETAKE_ONE', index })
      push('capture', { single: index })
    },
    [dispatch, push],
  )

  const singleDone = useCallback(
    (index, photo) => {
      dispatch({ type: 'SINGLE_DONE', index, photo })
      goBack()
    },
    [dispatch, goBack],
  )

  // In-app Back button on Capture (idle): Landing, or Editor in single mode.
  const back = useCallback(() => {
    dispatch({ type: stateRef.current.captureMode === 'full' ? 'GO_LANDING' : 'SINGLE_CANCEL' })
    goBack()
  }, [dispatch, goBack])

  const discardNow = useCallback(() => {
    dispatch({ type: 'DISCARD' })
    goBack() // to the capture entry below the editor
  }, [dispatch, goBack])

  // R9.5: confirm only when unsaved.
  const retakeAll = useCallback(() => {
    if (stateRef.current.unsaved) setPending('retakeAll')
    else discardNow()
  }, [discardNow])

  const confirmDiscard = useCallback(() => {
    setPending(null)
    discardNow()
  }, [discardNow])

  const keep = useCallback(() => setPending(null), [])

  return {
    pending,
    start,
    sessionDone,
    retakeOne,
    singleDone,
    back,
    retakeAll,
    confirmDiscard,
    keep,
  }
}
