# Lilim: Implementation Status (baseline as of 2026-11-13)

Instruction for Kiro: this is the state of the code before any spec work.
Generate design.md and tasks.md only for work that is missing or partial.
Do not re-implement items marked Done.

## Stack and structure
- React + Vite, plain CSS in src/index.css. No router, no test runner, no PWA plugin.
- src/App.jsx holds two state values: `screen` ('landing' | 'capture' | 'editor')
  and `photos` (array of 4 JPEG data URLs). Screens switch with useState.
  There is no browser-history integration yet, which Requirement 9 will need.
- src/components/Landing.jsx, Capture.jsx, Editor.jsx.
- Photos are captured at 960x720. The strip canvas is 1080x3230
  (60 px padding, 30 px gaps, 200 px footer, currently empty).
- App name shown to users must be "Lilim". The code currently says "Lilim Photobooth"
  in the Landing title and index.html title, and downloads as "lilim-strip.png".

## Status by requirement
- R1 Capture reliability: PARTIAL.
  Done: 4 photos in order, one capture loop at a time (Start disabled while shooting),
  camera tracks stopped when leaving the screen, center-crop to 960x720, mirrored output.
  Missing: waiting for non-zero video dimensions and the 5 s timeout, detecting a stream
  that ends mid-session, mirroring only for the user-facing camera, and the crop logic
  as a pure exported function (it is inline in takePhoto).
- R2 Camera error recovery: PARTIAL.
  Done: separate messages for permission denied, no camera, generic failure, and no
  getUserMedia (insecure context); Back button on the error screen.
  Missing: Try Again button, "camera in use" message, disconnect detection,
  permission re-enable instructions, OverconstrainedError retry.
- - R3 Capture options: NOT STARTED.
  The countdown is fixed at 3 s. There is no timer choice, no Cancel button, no Switch Camera.
  The Back button is enabled during a session and exits to Landing, which stops the loop and releases the camera.
  It is not a Cancel that keeps the preview.
- R4 Single-photo retake: NOT STARTED.
  The Editor's Retake button only restarts all 4 photos. There is no Session_Date.
- R5 Caption and date: NOT STARTED. The 200 px footer is reserved but blank.
- R6 Frame designs and stickers: PARTIAL.
  Done: 10 solid colors plus the custom color picker.
  Missing: patterns, gradients, and all sticker features (set, drag, resize, rotate, flip, delete).
- R7 Filters: PARTIAL.
  Done: None, B&W, Sepia, Warm. They run on pixel data, apply to the photo areas only,
  are non-destructive (always applied from the original photos), and leave alpha unchanged.
  Missing: Cool, Vintage, High Contrast, Soft Fade, and moving the filters out of
  Editor.jsx into pure testable functions.
- R8 Export: PARTIAL.
  Done: PNG download at full canvas resolution, built with toBlob.
  Missing: timestamped file name, Web Share button, Print Sheet, error messages when
  export fails.
- R9 Navigation guards: NOT STARTED.
- R10 Responsiveness: PARTIAL.
  Done: mobile-first CSS, 100dvh, 44 px swatches and chips, 900 px breakpoint
  (strip beside controls), 4:3 camera preview.
  Not done or not verified: 320-1920 px check, safe-area insets, short landscape
  layout, keeping photos on resize.
- R11 Accessibility and metadata: MINIMAL.
  Done: html lang="en", viewport meta, aria-labels on swatches and the color input.
  Missing: live regions, focus indicators, reduced motion, canvas text alternative,
  favicon, meta description, theme-color.
- R12 Privacy: BEHAVIOR HOLDS, NOT VERIFIED.
  No network calls or storage writes in the current code. Missing: the Landing privacy
  statement. The Supabase dependency makes the privacy guarantee easier to break
  (see R13).
- R13 Dependency cleanup: NOT DONE.
  @supabase/supabase-js and qrcode.react are installed. The .env may contain
  VITE_SUPABASE_* entries. Versions were installed with npm defaults, so they are
  not pinned to exact versions. Check that .env is in .gitignore and not tracked.
- R14 Tests: NOT STARTED. No runner, no tests, no `npm test` script.
- R15 README: NOT STARTED. README.md exists, but its content has not been written.
- R16 Deployment: NOT STARTED. The repo is on GitHub. Not deployed, no hosting config.
- R17 Offline and PWA: NOT STARTED.
- R18 Shared and event use: NOT STARTED.

15. THE Photobooth SHALL display the name "Lilim" as the Landing_Screen title and the document title, and SHALL use "Lilim" as the Web_Manifest name and short_name.

add to the glosarry:
- **Selected_Sticker**: The Sticker currently chosen for editing. At most one Sticker is selected at a time.
- **Sticker_Transform**: A Sticker's center position, scale, rotation angle and horizontal flip state, stored in Strip canvas coordinates.

2. Replace criteria 5 to 10 of Requirement 6 (criteria 1 to 4 stay as they are)
5. THE Editor_Screen SHALL offer at least 6 Stickers drawn from locally bundled assets.
6. WHEN the user chooses a Sticker from the Sticker set, THE Editor_Screen SHALL add it near the center of the Strip at its default size, with no rotation and no flip, fully inside the Strip bounds, and SHALL make it the Selected_Sticker.
7. WHEN the user drags a Sticker with a mouse, touch or pen, THE Editor_Screen SHALL move the Sticker to follow the pointer and SHALL keep the Sticker's center inside the Strip bounds.
8. THE Editor_Screen SHALL let the user resize the Selected_Sticker between 25% and 300% of its default size.
9. THE Editor_Screen SHALL let the user rotate the Selected_Sticker to any angle from 0 to 359 degrees.
10. THE Editor_Screen SHALL provide a Flip control that mirrors the Selected_Sticker horizontally, and pressing it twice SHALL restore the original orientation.
11. THE Editor_Screen SHALL provide a Delete control for the Selected_Sticker and a control to remove all Stickers from the Strip.
12. WHEN the user taps or clicks an area of the Strip with no Sticker, THE Editor_Screen SHALL clear the Selected_Sticker.
13. THE Editor_Screen SHALL limit the Strip to a maximum of 10 Stickers.
14. IF the user chooses a Sticker while the Strip holds 10 Stickers, THEN THE Editor_Screen SHALL display a message stating that the 10-Sticker limit is reached and SHALL leave the Stickers unchanged.
15. THE Editor_Screen SHALL draw Stickers in front of the Photos and after the Filter, so the Filter does not change Sticker pixels.
16. WHEN the Strip is exported, THE Editor_Screen SHALL draw each Sticker at the same Sticker_Transform shown on screen, regardless of the display scale in Requirement 10 criterion 7.
17. THE Editor_Screen SHALL NOT draw selection outlines or handles in any exported file.
18. WHILE the user drags a Sticker on a touch device, THE Editor_Screen SHALL prevent the page from scrolling.
19. THE Editor_Screen SHALL let the user move the Selected_Sticker with the arrow keys in steps of 10 px of Strip canvas coordinates, resize it with the + and - keys, and operate rotate, flip and delete with buttons that have accessible names.
20. WHEN the Frame_Design, the Filter or the Photos change, THE Editor_Screen SHALL keep every Sticker_Transform unchanged.


## Owner decisions (2026-11-13)
- QR code and Supabase upload are permanently dropped. Photos stay on the device so the app works offline.
- Stickers must support drag, resize, rotate and flip.
- Visual style notes are pending. The meme template and the moving landing text wait for them.
- Hosting is left to the owner. Requirement 16 leaves the host unnamed.

When you ask Kiro to generate design.md and tasks.md, tell it to read the status file first, so the Done items don’t turn into new tasks.