# Implementation Plan: Lilim Photobooth Completion

## Overview

This plan finishes the Lilim photobooth in JavaScript (React 19 + Vite, plain CSS), following `design.md`. Language is fixed by the design, so no language choice is needed.

The status file `docs/handoff-from-claude.md` is the baseline. Items it marks Done are not rebuilt. Where the design labels an area "Refactor", the task only moves existing behavior into pure modules and adds tests that protect it. Items labelled "Existing (preserve)" get no task: the 4-photo loop with Start disabled while shooting, track stop on leave, the error-screen Back button, the 10 solid frame colors and custom color picker, PNG download via `toBlob`, the 900 px breakpoint, and the 44 px swatches and chips.

Out of scope: shared/event use (R18, Next Person), the visual style, the meme template and the moving landing text.

Order: dependency cleanup and test setup, pure `src/lib/` modules with property tests, camera and capture, app reducer and history guards, editor features, export, responsiveness and accessibility, PWA, then README and deployment.

## Tasks

- [x] 1. Dependency cleanup and test setup
  - [x] 1.1 Remove unused dependencies and pin versions
    - Uninstall `@supabase/supabase-js` and `qrcode.react` (updates `package.json` and `package-lock.json`)
    - Remove any `VITE_SUPABASE_*` lines from `.env`
    - Confirm `.env` is listed in `.gitignore` (it is) and is not tracked (`git ls-files .env` is empty). If tracked, run `git rm --cached .env`
    - Add `.npmrc` with `save-exact=true`
    - Rewrite every dependency and devDependency in `package.json` to the exact installed version (no `^`, `~`, `>`, `<`, `*`, `x`, `latest`)
    - Confirm `src/` and `index.html` have no case-insensitive match for `supabase` or `qrcode.react`
    - Run `npm ci` then `npm run build` and confirm exit code 0
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 1.2 Install and configure the test tooling
    - Run `npm install --save-exact --save-dev vitest fast-check @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`
    - Add the `test` block to `vite.config.js` (`environment: 'jsdom'`, `setupFiles: './src/test/setup.js'`, `globals: true`)
    - Create `src/test/setup.js`: load `@testing-library/jest-dom`, call `fc.configureGlobal({ numRuns: 100 })`, and stub `HTMLDialogElement.prototype.showModal` / `close` (jsdom does not implement them fully)
    - Add the script `"test": "vitest --run"` to `package.json`
    - Add one trivial passing test to prove the runner works, then confirm `npm test` exits 0
    - _Requirements: 14.1, 14.3, 14.12, 13.6_

  - [x]* 1.3 Write static smoke tests for project hygiene
    - Create `src/test/project.test.js`
    - Assert every dependency version in `package.json` is exact
    - Assert `@supabase/supabase-js` and `qrcode.react` are absent from `package.json`
    - Assert no `supabase` / `qrcode.react` text in `src/` and `index.html`
    - Assert `.gitignore` lists `.env`
    - _Requirements: 13.1, 13.3, 13.5, 13.6_

- [x] 2. Pure library modules and property tests
  - [x] 2.1 Create `src/lib/layout.js`
    - Export `PHOTO_W`, `PHOTO_H`, `PAD`, `GAP`, `FOOTER`, `STRIP_W`, `STRIP_H`, `photoRects()` and `FOOTER_RECT`
    - Values: 960, 720, 60, 30, 200, 1080, 3230
    - Note: the inline copies in `Capture.jsx` and `Editor.jsx` are replaced by imports in tasks 4.6 and 7.5
    - _Requirements: 1.7, 5.9, 10.7_

  - [x] 2.2 Extract the crop logic into `src/lib/crop.js` (Refactor)
    - Export pure `cropRect(frameW, frameH)` returning `{ sx, sy, sw, sh }` with the same math as the inline `takePhoto` in `Capture.jsx`
    - Export pure `isMirrored(trackSettings)`: false only when `facingMode === 'environment'`
    - _Requirements: 1.8, 1.9, 1.10, 3.8_

  - [x]* 2.3 Write property tests for crop and mirroring
    - Create `src/lib/crop.test.js` (`// @vitest-environment node`)
    - **Property 1: Crop rectangle is a centered 4:3 region inside the frame**
    - **Property 2: Mirroring follows the camera facing mode**
    - **Validates: Requirements 1.8, 1.9, 1.10, 3.8, 14.4**

  - [x] 2.4 Move filters into pure `src/lib/filters.js` (Refactor + New)
    - Export `FILTERS` keyed `none, bw, sepia, warm, cool, vintage, contrast, fade`, each `{ label, apply }`
    - `apply(pixels)` returns a new `Uint8ClampedArray` of the same length, copies alpha, never mutates input
    - Keep the existing None, B&W, Sepia and Warm formulas from `Editor.jsx`. Add Cool, Vintage, High Contrast and Soft Fade as specified in the design
    - Do not edit `Editor.jsx` here (task 7.5 switches it over)
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x]* 2.5 Write property tests for filters
    - Create `src/lib/filters.test.js` (`// @vitest-environment node`), generators use `Uint8ClampedArray` with length a multiple of 4, including empty and 0/255 extremes
    - **Property 24: Filters keep a valid pixel array**
    - **Property 25: None is the identity**
    - **Property 26: B&W makes equal channels and is idempotent**
    - **Validates: Requirements 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 14.5, 14.6**

  - [x] 2.6 Create `src/lib/dateStamp.js`
    - Export `formatDateStamp(date)` producing "MMM D, YYYY" from a fixed English month table (no `Intl`)
    - Export `parseDateStamp(str)` returning `{ year, month, day }` or `null`
    - _Requirements: 5.4, 5.5, 5.6_

  - [x]* 2.7 Write property tests for the date stamp
    - Create `src/lib/dateStamp.test.js` (`// @vitest-environment node`), dates in years 1000 to 9999
    - **Property 8: Date stamp format**
    - **Property 9: Date stamp round trip**
    - **Validates: Requirements 5.4, 5.5, 5.6, 14.7**

  - [x] 2.8 Create `src/lib/contrast.js` and `src/lib/footerLayout.js`
    - `contrast.js`: `contrastRatio(hexA, hexB)` (WCAG 2.x) and `pickTextColor(colors)` returning `'#000000'` or `'#ffffff'` with the best worst-case contrast
    - `footerLayout.js`: constants `CAPTION_MAX=40`, `CAPTION_SIZE=48`, `CAPTION_MIN_SIZE=16`, `DATE_SIZE=32`; `fitCaption(measure, text, maxWidth, size, min)` (shrink to min, then truncate with an ellipsis); `footerLayout({ hasCaption, showDate })` returning boxes inside `FOOTER_RECT`, centered, caption above date, no overlap
    - _Requirements: 5.2, 5.7, 5.8, 5.9, 5.10, 5.11_

  - [x]* 2.9 Write property tests for caption fitting and footer layout
    - Create `src/lib/footerLayout.test.js` (`// @vitest-environment node`), use a monotonic injected `measure`
    - **Property 10: Caption fitting**
    - **Property 11: Footer layout stays inside the footer without overlap**
    - **Validates: Requirements 5.2, 5.7, 5.8, 5.9, 5.10**

  - [x] 2.10 Create `src/lib/stickerPlacement.js`
    - Export constants `STICKER_BASE=80`, `MAX_STICKERS=10`, `SCALE_MIN=0.25`, `SCALE_MAX=3`
    - Export `halfExtent`, `isValid`, `placeNew`, `moveTo`, `clampScale`, `clampRotation`, `keyboardMove`, `normalizeAngle` exactly as described in the design (AABB overlap rule, slide along edges, bisection for scale, 1-degree walk for rotation)
    - Export `flipSticker(t)` and `clientToStrip(clientX, clientY, rect)` / `stripToClient(...)` for pointer mapping that is independent of display scale
    - _Requirements: 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.17, 6.19, 6.21, 6.23_

  - [x]* 2.11 Write property tests for sticker placement
    - Create `src/lib/stickerPlacement.test.js` (`// @vitest-environment node`), generate valid transforms by filtering with `isValid`
    - **Property 14: New stickers are placed validly at default settings**
    - **Property 15: Dragging never covers a photo and slides along edges**
    - **Property 16: Resize is clamped to a valid size**
    - **Property 17: Rotation is clamped to a valid angle**
    - **Property 18: Flip is an involution**
    - **Property 21: Pointer mapping is independent of display scale**
    - **Property 22: Keyboard moves are small and valid**
    - **Validates: Requirements 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.17, 6.19, 6.21, 10.7, 14.8**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Camera and capture
  - [x] 4.1 Create `src/lib/cameraErrors.js` and `src/lib/cameraService.js`
    - `cameraErrors.js`: `classifyCameraError(err)` and `CAMERA_MESSAGES` (distinct text per code; `denied` includes step-by-step re-enable instructions)
    - `cameraService.js`: `isCameraAvailable(win)`, `startCamera({ deviceId })` (first request keeps `facingMode: 'user'`, ideal 1280x960; one retry with `{ video: true }` on `OverconstrainedError`), `stopStream`, `listVideoInputs`, `nextDeviceId(devices, currentId)`
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.8, 2.11, 3.7_

  - [x]* 4.2 Write property tests for camera errors and device cycling
    - Create `src/lib/camera.test.js` (`// @vitest-environment node`)
    - **Property 3: Camera errors map to a stable code**
    - **Property 4: Next camera is cyclic in list order**
    - **Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.11, 3.7**

  - [x] 4.3 Create `src/lib/sessionRunner.js`
    - Export `waitForVideoReady(video, { timeoutMs = 5000, signal })`, `abortableSleep(ms, signal)` and `runSession({ shots, countdownSec, signal, capture, onCount, onShot, sleep })`
    - Return a fresh array only on full completion. On abort, reject with `AbortError` and drop partial photos
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 3.3, 3.4, 12.5_

  - [x]* 4.4 Write unit tests for the session runner
    - Create `src/lib/sessionRunner.test.js` with an injected `sleep` and fake timers
    - Cover capture order, 1-shot and 4-shot runs, immediate abort with no partial array, `waitForVideoReady` waiting for non-zero size and rejecting after 5 s
    - _Requirements: 1.2, 1.3, 1.4, 3.4, 12.5_

  - [x] 4.5 Create `src/hooks/useCamera.js`
    - Return `{ status, error, stream, videoInputs, mirrored, start, retry, switchCamera }`
    - Use an `inFlight` ref so rapid `retry` / `switchCamera` calls send one request and the buttons can be disabled while pending. Keep the `cancelled` guard for StrictMode
    - Stop the previous stream before each request. Attach `ended` listeners (set `disconnected` error) and refresh `videoInputs` on `devicechange`
    - _Requirements: 1.5, 1.6, 2.6, 2.7, 2.9, 2.10, 3.6, 3.7, 3.9_

  - [x] 4.6 Refactor `src/components/Capture.jsx` to use the new modules
    - Props: `{ mode, prefs, onPrefs, onDone, onBack, onSessionRunning }`
    - Replace the inline crop with `cropRect`, the inline layout constants with `lib/layout.js`, and the unconditional mirror with `isMirrored`. Change the CSS rule to `.camera video.mirrored`
    - Run the loop through `runSession` with one `AbortController` per session. Abort on Cancel, stream `ended` and unmount
    - Add: wait for video ready (5 s timeout), timer choice 3/5/10 s (default 3), Cancel button while running, Switch Camera when more than one input, error view with `role="alert"`, Try Again (disabled while pending) and the existing Back button, `LiveRegion` announcements for countdown and "Photo N of 4"
    - Disable timer choice, Switch Camera and Back while a session runs. Keep the preview active after Cancel
    - Support `mode = { single: i }`: capture exactly one photo and call `onDone([photo])`
    - Create `src/components/LiveRegion.jsx` (polite `aria-live`)
    - Keep the preserved behavior: 4 photos per session, Start disabled while running, tracks stopped on unmount
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.10, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.3, 10.8, 11.4, 11.5_

  - [x]* 4.7 Write component tests for camera errors and Try Again
    - Create `src/components/Capture.test.jsx` with a mocked `navigator.mediaDevices`
    - Verify a distinct message for denied, not found, in use, disconnected (fire `ended`) and insecure context (`isSecureContext = false`, no `getUserMedia` call)
    - Verify each Try Again press sends exactly one request, including rapid presses, and the OverconstrainedError retry with `{ video: true }`
    - Verify Cancel stops the session, keeps the preview and re-enables Start
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 2.10, 2.11, 3.4, 14.9, 14.10_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. App reducer, history and guards
  - [x] 6.1 Create `src/appReducer.js`
    - Export `initialState`, `defaultEditorSettings()`, `appReducer`, and `needsConfirm(state, action)`
    - Implement the actions listed in the design: `START`, `SESSION_DONE`, `SINGLE_DONE`, `SINGLE_CANCEL`, `RETAKE_ONE`, `RETAKE_ALL`, `DISCARD`, `SET_FRAME`, `SET_FILTER`, `SET_CAPTION` (truncate to 40), `SET_SHOW_DATE`, `STICKER_ADD/MOVE/SCALE/ROTATE/FLIP/DELETE/CLEAR/SELECT`, `EXPORTED`, `SET_PREFS`, `SESSION_RUNNING`
    - `SINGLE_DONE` replaces one photo and keeps `sessionDate`, editor settings and prefs. `DISCARD` and `RETAKE_ALL` reset photos, `sessionDate`, editor settings and `unsaved` but keep prefs. Every editor action sets `unsaved`. `EXPORTED` clears it
    - `STICKER_ADD` uses `placeNew`, enforces the 10-sticker limit and reports "limit" / "no space" notices without changing the list
    - No storage API use anywhere
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.12, 6.6, 6.13, 6.15, 6.16, 6.17, 6.22, 9.4, 9.5, 9.7, 9.10, 9.11, 12.1, 12.4, 17.12_

  - [x]* 6.2 Write property tests for the reducer
    - Create `src/appReducer.test.js` (`// @vitest-environment node`), generate states from `defaultEditorSettings()` plus random actions
    - **Property 5: Single retake replaces only the selected photo**
    - **Property 6: Cancelling a single retake changes nothing**
    - **Property 7: Caption never exceeds 40 characters**
    - **Property 19: Delete removes exactly one sticker**
    - **Property 20: Sticker count never exceeds 10**
    - **Property 23: Other edits keep sticker transforms**
    - **Property 29: Confirmation guard**
    - **Property 30: Reset leaves no previous user data**
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 6.13, 6.15, 6.16, 6.22, 9.4, 9.5, 9.7, 9.9, 9.10, 9.11, 12.4, 17.12**

  - [x] 6.3 Create `src/hooks/useAppNavigation.js` and `src/components/ConfirmDialog.jsx`
    - `useAppNavigation`: `history.pushState({ screen, mode })` per screen change, `history.back()` for returns, a single `popstate` handler applying the guards, `replaceState(landing)` on load with a non-landing state, `beforeunload` listener attached only while `unsaved` is true
    - Browser Back during a session aborts it and re-pushes the Capture entry. Browser Back on an unsaved Editor re-pushes and opens the dialog
    - `ConfirmDialog`: native `<dialog>` with `showModal()`, Discard and Keep buttons, initial focus on Keep, the `cancel` event (Escape) acts as Keep
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 11.1_

  - [x] 6.4 Rewrite `src/App.jsx` around the reducer and navigation
    - Hold state in `useReducer(appReducer)` and wire `useAppNavigation`, `ConfirmDialog` (pending actions `leave`, `retakeAll`, `reload`), and the `Capture`, `Editor` and `Landing` screens
    - Pass `mode`, `prefs` and the session callbacks to `Capture`. Pass controlled settings and dispatch to `Editor`
    - Per-photo Retake pushes a capture entry with no dialog. Retake All asks for confirmation only when unsaved
    - _Requirements: 4.2, 4.4, 4.6, 4.7, 4.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.8, 9.11, 12.4_

  - [x]* 6.5 Write component tests for history and the confirmation dialog
    - Create `src/App.test.jsx`
    - Verify `pushState` per screen change, Back on Capture (idle, in a session), Back on an unsaved Editor opens the dialog, Escape acts as Keep, Discard returns to a ready Capture, no dialog or `beforeunload` when saved, no dialog on per-photo Retake
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11_

- [x] 7. Editor features: frames, footer, filters, stickers
  - [x] 7.1 Refactor `src/lib/frames.js`
    - Keep the 10 existing solid colors unchanged as `SOLID_COLORS`
    - Add `FRAMES` with `paint(ctx, w, h)` and `footerColors`: the solids plus patterns `dots`, `stripes`, `checks` and gradients `gradient-a`, `gradient-b`, `gradient-c`, reusing the existing palette
    - Support a custom solid `{ kind: 'custom', color }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 5.11_

  - [x]* 7.2 Write a test for built-in frame text contrast
    - **Property 12: Footer text is readable on any solid frame color**
    - Create `src/lib/frames.test.js` (`// @vitest-environment node`): property over random custom colors, plus an example over every built-in frame's `footerColors`
    - **Validates: Requirements 5.11**

  - [x] 7.3 Create `src/lib/describeStrip.js` and refactor `src/lib/renderStrip.js`
    - `describeStrip(state)`: photo count, filter label, frame label, caption (or "no caption"), date text (or "hidden"), sticker count
    - `renderStrip(ctx, { frame, photoCanvases, caption, showDate, sessionDate, stickers, stickerImages })` from `Editor.drawStrip`. Draw order: frame, photos, footer text (using `fitCaption`, `footerLayout`, `pickTextColor`), stickers (translate, rotate, flip, draw). No selection outlines
    - One function renders both the screen canvas and the export canvas
    - _Requirements: 5.2, 5.3, 5.4, 5.9, 5.10, 5.11, 6.4, 6.18, 6.19, 7.2, 11.6_

  - [x]* 7.4 Write tests for strip rendering and its description
    - Create `src/lib/renderStrip.test.js` using a recording stub 2D context (no canvas package)
    - **Property 13: Frame change does not alter photo areas**
    - **Property 31: Strip description reflects the state**
    - Add examples: draw order is frame, photos, text, stickers; empty caption with hidden date draws no text
    - **Validates: Requirements 5.10, 6.4, 6.18, 7.2, 11.6**

  - [x] 7.5 Refactor `src/components/Editor.jsx` into a controlled component
    - Import layout constants from `lib/layout.js`, filters from `lib/filters.js` and `renderStrip`. Delete the inline `FILTERS` and `drawStrip`
    - Settings come from `App` props and change through dispatch. Keep local state only for decoded images, filtered canvases and messages
    - Add `useFilteredPhotos`: four offscreen 960x720 canvases, all recomputed on filter change, one on photo replacement, originals never modified
    - Add controls: per-photo Retake 1 to 4, Retake All, caption input (`maxLength=40`), date toggle, 8 filter chips, 16 frames plus the existing custom picker, selected-frame marking. Keep the existing swatch, picker and chip markup
    - Canvas gets `role="img"` and `aria-label={describeStrip(...)}`
    - Clear offscreen canvas sizes and image references on unmount
    - _Requirements: 4.1, 4.5, 4.8, 5.1, 5.2, 5.3, 5.12, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.9, 7.10, 11.3, 11.6, 12.4_

  - [x] 7.6 Create the sticker UI
    - Add 6 neutral SVGs in `src/assets/stickers/` (star, heart, circle, sparkle, flower, bolt) with explicit `width` and `height`, imported with `?url` and decoded once. A failed decode skips that sticker and shows an error
    - `StickerLayer.jsx`: overlay `div` matching the canvas aspect ratio, hit elements with `role="button"`, `tabIndex=0`, accessible names, `touch-action: none`, pointer capture drag, two-pointer pinch and twist, arrow keys (10 px), `+` / `-` resize, `Delete`, background tap clears selection. Outlines are DOM only
    - `StickerControls.jsx`: palette of 6 buttons, size slider (25 to 300%), rotation slider (0 to 359), rotate left / right 15 degrees, Flip, Delete, Remove All, and a message region for "limit reached" and "no space"
    - Mount both in `Editor.jsx`
    - _Requirements: 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15, 6.16, 6.17, 6.19, 6.20, 6.21, 11.3_

  - [x]* 7.7 Write component tests for the sticker UI
    - Create `src/components/StickerControls.test.jsx`
    - Verify the limit and no-space messages, keyboard move / resize / delete on a focused sticker, Flip twice restores orientation, Remove All, background click clears selection, and that every control has a non-empty accessible name
    - _Requirements: 6.12, 6.13, 6.14, 6.16, 6.17, 6.21, 11.3_

- [x] 8. Export, share and print sheet
  - [x] 8.1 Create `src/lib/fileName.js`, `src/lib/printSheet.js` and `src/lib/exportService.js`
    - `exportFileName(date, prefix = 'lilim-strip', ext = 'png')` giving `lilim-strip-YYYYMMDD-HHmmss.png` from local 24 h time
    - `printSheetLayout(sheetW, sheetH, stripW, stripH)` returning `{ scale, x, y, w, h }` (largest uniform scale, centered, never cropped)
    - `exportService.js`: `canvasToBlob` (rejects on a null blob), `downloadStrip`, `downloadPrintSheet` (1200x1800 white background), `canShareImages(nav)`, `shareStrip` (resolves `'shared'` or `'dismissed'` on `AbortError`, throws otherwise)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_

  - [x]* 8.2 Write property tests for file name and print sheet
    - Create `src/lib/export.test.js` (`// @vitest-environment node`)
    - **Property 27: Export file name format**
    - **Property 28: Print sheet layout fits, centers and never crops**
    - **Validates: Requirements 8.2, 8.9**

  - [x] 8.3 Wire export into `Editor.jsx`
    - Add Download, Share (shown only when `canShareImages`) and Download Print Sheet buttons
    - Dispatch `EXPORTED` on success and announce success through the live region. Show error messages for a failed blob, failed print sheet and non-dismiss share failure ("Sharing failed. Use Download instead."). Show nothing on dismissal. Keep state unchanged on error
    - Export draws from the same `renderStrip` function with no outlines or handles
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.10, 11.11, 17.4_

  - [x]* 8.4 Write component tests for export and share
    - Create `src/components/Editor.export.test.jsx` with a mocked anchor click, `navigator.share` / `canShare` and `toBlob`
    - Verify download, share success, dismissal with no message, share failure message, a null blob error, and the Print Sheet error
    - _Requirements: 8.1, 8.4, 8.5, 8.6, 8.7, 8.10, 11.11_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Responsiveness, accessibility and metadata
  - [x] 10.1 Update `src/index.css`
    - Keep `--bg`, `--ink`, `--accent`. Add `--on-accent` (value of `--ink`) for text on `.btn`, plus `--focus`, `--surface-muted`, `--space`
    - Add `:focus-visible` outline of 3 px, safe-area padding on `.screen`, the short landscape layout (`orientation: landscape` and `max-height: 500px`), strip wrapper width `min(100%, 300px, (100dvh - 32px) * 1080 / 3230)` with `aspect-ratio: 1080 / 3230`, 44 px minimum targets under 900 px for sticker buttons, sliders and toggles, `min-width: 0` and `max-width: 100%` to prevent horizontal scroll, and the `prefers-reduced-motion: reduce` rule disabling animations and transitions
    - Keep the existing 900 px breakpoint and 4:3 preview
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 11.1, 11.2, 11.7, 11.8, 17.8_

  - [x] 10.2 Update `index.html` and `src/components/Landing.jsx`
    - `index.html`: title "Lilim", meta description (1 to 160 characters), `theme-color` meta, favicon link (`public/favicon.svg`), `viewport-fit=cover`, keep `lang="en"`
    - `Landing.jsx`: title "Lilim", keep the tagline, add the visible privacy line "Your photos stay on this device. Nothing is uploaded."
    - Create the favicon
    - _Requirements: 11.9, 11.10, 11.12, 12.6, 10.5_

  - [x]* 10.3 Write static and accessibility tests
    - Create `src/test/a11y.test.js`
    - Palette test: parse `:root` variables from `index.css` and assert 4.5:1 for text pairs (including `--on-accent` on `--accent`) and 3:1 for focus and UI pairs using `contrastRatio`
    - Assert `index.css` contains safe-area, reduced-motion and focus rules
    - Assert `index.html` has the description (1 to 160 characters), `theme-color`, favicon and title "Lilim", and that the Landing renders the privacy line (at most 120 characters)
    - _Requirements: 10.5, 11.2, 11.7, 11.8, 11.9, 11.12, 12.6_

- [x] 11. PWA, offline and update
  - [x] 11.1 Configure the PWA in `vite.config.js` and add icons
    - `npm install --save-exact --save-dev vite-plugin-pwa`
    - Add `base: process.env.BASE_PATH ?? '/'`, `VitePWA({ registerType: 'prompt', injectRegister: null, manifest, workbox })` with no `runtimeCaching`
    - Manifest: name and short_name "Lilim", `start_url` and `scope` from the base, `display: 'standalone'`, theme and background colors from one exported constant equal to the `theme-color` meta, icons 192, 512 and 512 maskable
    - Create placeholder icons in `public/icons/`
    - _Requirements: 11.9, 11.12, 12.1, 16.1, 16.3, 17.1, 17.5, 17.6, 17.7, 17.13_

  - [x] 11.2 Add offline and update UI
    - `hooks/useOnlineStatus.js` and `components/OfflineIndicator.jsx`: banner with text ("You are offline. Everything still works.") and `role="status"`, shown within 2 s of going offline, removed within 2 s of returning, never blocks controls
    - `hooks/useServiceWorker.js` and `components/UpdatePrompt.jsx`: wrap `registerSW({ onNeedRefresh })` from `virtual:pwa-register`. Register only when `window.isSecureContext`. Swallow registration and offline update-check failures. Reload goes through the guard (Confirmation Dialog when unsaved or a session runs), then `updateSW(true)`. Never reload automatically
    - Mount both in `App.jsx`
    - _Requirements: 17.2, 17.3, 17.8, 17.9, 17.10, 17.11, 17.12, 17.14, 17.15, 17.16_

  - [x]* 11.3 Write tests for offline, update and manifest
    - Create `src/test/pwa.test.jsx`
    - Offline indicator: set `navigator.onLine` false, dispatch `offline`, assert the banner. Dispatch `online`, assert removal
    - Update prompt with a mocked `registerSW`: shows on `onNeedRefresh`, no reload until Reload is pressed, dialog opens when unsaved or capturing, registration skipped when `isSecureContext` is false, failures swallowed
    - Manifest smoke test: name, short_name, standalone, icon sizes, a maskable icon, theme color equals the `index.html` meta, no `runtimeCaching`
    - _Requirements: 11.9, 17.6, 17.8, 17.9, 17.10, 17.11, 17.12, 17.13, 17.14, 17.15, 17.16, 14.11_

  - [x]* 11.4 Write the privacy flow tests
    - Create `src/test/privacy.test.jsx`
    - Run Landing, Capture, Editor, Download with spies on `fetch`, `XMLHttpRequest`, `localStorage`, `sessionStorage`, `indexedDB.open` and `document.cookie`. Assert none are used and only the download click creates a file
    - Static check: no storage API use and no external URLs in `src/` and `index.html`
    - _Requirements: 12.1, 12.2, 12.3, 12.5, 17.5_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. README and deployment
  - [x] 13.1 Write `README.md`
    - What the app does in at most 3 sentences, one feature per line, commands with one-line descriptions (install, dev, build, preview, test), HTTPS or localhost requirement for the camera, the full privacy statement, sub-path deployment with `BASE_PATH`, PWA install steps (Chrome and Edge desktop, Chrome on Android, Safari on iOS), the note that offline use needs one prior online load, Supported_Browsers and known limitations (including the small sticker area noted in the design)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

  - [x] 13.2 Ask the owner which static host to use, then add its Hosting_Configuration
    - STOP and ask the owner which single static HTTPS host to deploy to (use the user_input tool). Do not choose a host. Do not create any hosting file until the owner answers
    - After the answer, add that host's config file so that HTTP redirects to HTTPS on the same path, `sw.js` is served with `Cache-Control: no-cache`, `manifest.webmanifest` is served as `application/manifest+json`, and `sw.js` is served as JavaScript
    - Name the host once in `README.md` and add its deploy steps
    - _Requirements: 16.2, 16.5, 16.6, 16.7, 15.6_

  - [x]* 13.3 Add build checks for the base path
    - Add a script or test that runs `BASE_PATH=/x/ npm run build` and scans `dist/` for root-relative asset paths (`src="/` or `href="/` not under `/x/`) and for external `http(s)://` URLs
    - Confirm `dist/index.html` exists
    - _Requirements: 16.1, 16.3, 17.5_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Run `npm ci`, `npm run build` and `npm test`. Ensure all tests pass with zero skipped tests, ask the user if questions arise.
  - The manual checklist in the design (320 to 1920 px widths, short landscape, safe areas, pinch and twist on a touch device, install, offline launch, update prompt, deployed-site checks) is for the owner to run and is not a coding task.

- [x] 15. Curtain booth visual redesign (see `docs/design-curtain-booth.md`; decisions: Fraunces, curtain animation yes, dark editor panel)
  - Look and feel only. No logic changes. Keep all existing behavior, aria labels and test ids that tests rely on.
  - [x] 15.1 Fonts and design tokens
    - Install exact-pinned `@fontsource-variable/fraunces` and `@fontsource-variable/instrument-sans` (or the closest available pair), import them in `src/main.jsx` so they are bundled (no external URLs)
    - Rewrite the `:root` tokens in `src/index.css` to the palette in the design doc, update global type scale, buttons (2 px radius, no pills), focus ring, inputs, dialog, banners to the new tokens
    - Update `THEME_COLOR` in `vite.config.js` and the `theme-color` meta in `index.html` to `#1c0f10` (they must stay equal), and the favicon colors
    - Update `src/test/a11y.test.js` so it reads the new tokens and still enforces the contrast thresholds
  - [x] 15.2 Landing curtain
    - Rework `Landing.jsx` and its CSS: curtain panels with CSS-only fold shading, title "Lilim" in Fraunces, tagline, privacy line, primary button "Step inside"
    - On press the curtains slide apart (about 500 ms) and then call the existing start handler; with `prefers-reduced-motion` call it immediately
  - [x] 15.3 Capture screen styling
    - Restyle `Capture.jsx`: preview in a thin paper frame, big serif countdown, paper-colored flash (120 ms), mono "01 / 04" progress label, segmented 3/5/10 timer control, slim control bar; error panel with Try Again
    - Keep all existing roles, labels and behavior
  - [x] 15.4 Editor layout and tabs
    - Restyle `Editor.jsx`: dark stage with faint spotlight behind the strip, 360 px dark side panel on desktop, same panel below the strip on mobile; strip slides in (200 ms)
    - Group controls into tabs (Frame, Filter, Stickers, Caption) using `role="tablist"`, `role="tab"`, `role="tabpanel"` with arrow-key navigation; Retake row with square buttons 1 to 4 plus Retake all; Download, Share and Print sheet pinned at the bottom of the panel
    - Sticker controls and caption input must keep working and stay reachable by keyboard
  - [x] 15.5 Strip frame palette
    - Replace the built-in solid frames in `src/lib/frames.js` with: paper, ink, oxblood, forest, navy, mustard, blush; retint patterns and gradients to this palette; keep the 4.5:1 text contrast test passing and keep the custom color option
  - [x] 15.6 Verify
    - Update any existing tests broken by markup changes without weakening them, add a small test for the Landing curtain (reduced motion starts immediately) and the editor tabs (arrow keys)
    - Run `npm run build` and `npm test`; all must pass
## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the universal correctness properties 1 to 31 from the design. Each runs at least 100 cases and carries the tag comment `// Feature: photobooth-completion, Property N: <text>`
- Unit tests validate specific examples and edge cases
- Items marked Done in `docs/handoff-from-claude.md` are preserved and get no new implementation task

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "2.2", "2.4", "2.6", "4.1", "8.1"] },
    { "id": 3, "tasks": ["2.3", "2.5", "2.7", "2.8", "2.10", "4.2", "4.3", "8.2"] },
    { "id": 4, "tasks": ["2.9", "2.11", "4.4", "4.5", "7.1"] },
    { "id": 5, "tasks": ["4.6", "6.1", "7.2", "7.3"] },
    { "id": 6, "tasks": ["4.7", "6.2", "6.3", "7.4", "7.6"] },
    { "id": 7, "tasks": ["6.4", "7.5"] },
    { "id": 8, "tasks": ["6.5", "7.7", "8.3"] },
    { "id": 9, "tasks": ["8.4", "10.1", "10.2"] },
    { "id": 10, "tasks": ["10.3", "11.1"] },
    { "id": 11, "tasks": ["11.2"] },
    { "id": 12, "tasks": ["11.3", "11.4", "13.1"] },
    { "id": 13, "tasks": ["13.2", "13.3"] }
  ]
}
```
