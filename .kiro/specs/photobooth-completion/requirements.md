# Requirements Document

## Introduction

Lilim is a React + Vite web app. The name shown to users is "Lilim". The user opens the Landing screen, takes 4 photos on the Capture screen, then edits and downloads a vertical photo strip on the Editor screen. The Strip canvas is 1080x3230 px with 60 px padding, 30 px gaps between Photos and a 200 px Footer. Each Photo is 960x720 px.

The app is used in two settings: on a personal phone and on a laptop or desktop. Photos stay on the device only. The QR code feature and the Supabase upload are permanently dropped, so the app works offline.

This spec covers the work needed to finish the app: capture reliability, camera error recovery, capture options, single-photo retake, caption and date, frame designs and stickers, filters, export and sharing, navigation guards, responsiveness, accessibility, privacy, dependency cleanup, tests, a README, deployment, and offline and installable (PWA) support. All features listed here are required. Accounts, a backend and analytics are out of scope. Shared or event-booth use (for example a Next Person reset) is out of scope.

The visual style (colors, fonts, theme) is pending notes from the owner. The meme template and the moving landing text are deferred until those notes arrive and are out of scope for this spec. This spec does not define a visual style.

### Current baseline

The file docs/handoff-from-claude.md is the status file for the current code and the owner's decisions. Requirements marked Done there describe behavior that must be preserved, not rebuilt. Each requirement below carries a short "Baseline" note taken from that file. Criteria that describe Done behavior are worded as "continue to" or "preserve" and produce no new implementation work.

## Glossary

- **Photobooth**: The complete web application, shown to users as "Lilim".
- **Landing_Screen**: The first screen, with the title, tagline, privacy statement and Start button.
- **Capture_Screen**: The screen showing the live camera preview and capture controls.
- **Editor_Screen**: The screen showing the Strip canvas, frame, filter, footer, sticker and export controls.
- **Session**: One run of capturing the set of 4 Photos.
- **Single_Shot_Mode**: A Capture_Screen mode that captures exactly 1 Photo to replace one selected Photo position in the Strip.
- **Session_Date**: The local date recorded when a Session completes, used for the Date_Stamp. A single retake keeps the existing Session_Date.
- **Photo**: One 960x720 JPEG image produced by the Capture_Screen.
- **Photo_Area**: The rectangle of the Strip occupied by one of the 4 Photos.
- **Strip**: The vertical composition of 4 Photos, Frame_Design, Footer and Stickers drawn on the Strip canvas of 1080x3230 px.
- **Footer**: The 200 px area at the bottom of the Strip below the fourth Photo.
- **Caption**: User-entered text drawn in the Footer.
- **Date_Stamp**: The Session_Date drawn in the Footer, formatted as a string.
- **Frame_Design**: A background style for the Strip (solid color, pattern or gradient).
- **Sticker**: A decorative graphic placed on the Strip.
- **Selected_Sticker**: The Sticker currently chosen for editing. At most one Sticker is selected at a time.
- **Sticker_Transform**: A Sticker's center position, scale, rotation angle and horizontal flip state, stored in Strip canvas coordinates.
- **Filter**: A pixel transformation applied to the Photo_Areas of the Strip.
- **Camera_Service**: The module that requests, switches and releases the camera stream.
- **Crop_Function**: The pure function that center-crops a camera frame to a 4:3 region.
- **Sticker_Placement_Function**: The pure function that places and clamps a Sticker_Transform so the Sticker stays inside the Strip and outside every Photo_Area.
- **Print_Sheet**: A 1200x1800 px PNG layout containing the Strip.
- **Unsaved_State**: The state that starts when a Session completes and ends when the user downloads, shares or saves a Print_Sheet. The state starts again after any later change to the Photos, Frame_Design, Filter, Stickers, Caption or Date_Stamp setting.
- **Confirmation_Dialog**: A dialog with a Discard button and a Keep button that asks the user to confirm leaving the Unsaved_State.
- **Service_Worker**: The browser worker that precaches the built assets for offline use.
- **Web_Manifest**: The web app manifest that makes the Photobooth installable.
- **Hosting_Configuration**: The configuration file of the one static HTTPS host chosen by the owner.
- **Offline_Indicator**: A visible UI element showing that the device has no network connection.
- **Update_Prompt**: A visible UI element offering to reload into a newly deployed version.
- **Reduced_Motion_Preference**: The user's `prefers-reduced-motion: reduce` operating system setting.
- **Supported_Browser**: The current stable release of Chrome, Edge, Firefox or Safari on desktop or mobile.

## Requirements

### Requirement 1: Capture reliability

Baseline: Partial. See handoff status file.

**User Story:** As a user, I want every capture session to finish with four correct photos, so that I never end up with a blank or partial strip.

#### Acceptance Criteria

1. THE Capture_Screen SHALL continue to capture 4 Photos per Session, to run one capture loop at a time, and to disable the Start button while a Session is running (preserve).
2. WHEN a Session starts, THE Capture_Screen SHALL capture each of the 4 Photos at the end of its own countdown, and THE Strip SHALL show the Photos from top to bottom in capture order.
3. WHEN the Start button is pressed and the video element reports a videoWidth or videoHeight of 0, THE Capture_Screen SHALL delay the countdown until the video reports non-zero dimensions.
4. IF the video dimensions stay 0 for 5 seconds after the Start button is pressed, THEN THE Capture_Screen SHALL cancel the start and display a camera error with a Try Again button.
5. IF the camera stream ends during a Session, THEN THE Capture_Screen SHALL stop the Session within 1 second, discard the partial Photos and display a camera error with a Try Again button.
6. WHEN the user leaves the Capture_Screen, THE Camera_Service SHALL continue to stop all tracks of the camera stream within 1 second (preserve).
7. WHEN a Session completes, THE Capture_Screen SHALL pass exactly 4 Photos to the Editor_Screen, each with dimensions of 960x720 pixels.
8. THE Crop_Function SHALL be a pure function exported from its module.
9. FOR ALL camera frame sizes with positive width and height, THE Crop_Function SHALL return a source rectangle that lies entirely within the frame, is centered on the frame and has a 4:3 aspect ratio within a tolerance of 1 px.
10. WHERE the active camera is the user-facing camera, THE Capture_Screen SHALL mirror the saved Photos horizontally, as specified in Requirement 3 criterion 8.

### Requirement 2: Camera error recovery

Baseline: Partial. See handoff status file.

**User Story:** As a user, I want clear messages and a way to retry when the camera fails, so that I can recover without reloading the page.

#### Acceptance Criteria

1. IF camera access fails, THEN THE Capture_Screen SHALL display an error message that names the cause, and SHALL keep the Start button disabled until the camera is available.
2. THE Capture_Screen SHALL continue to display a Back button on the error screen that returns to the Landing_Screen (preserve).
3. IF camera permission is denied, THEN THE Capture_Screen SHALL display a message stating that permission was denied, step-by-step instructions for re-enabling camera permission in the browser settings, and a Try Again button.
4. IF the browser reports a NotFoundError, THEN THE Capture_Screen SHALL display a message stating that no camera was found, and a Try Again button.
5. IF the browser reports a NotReadableError or TrackStartError, THEN THE Capture_Screen SHALL display a message stating that the camera is in use by another application, and a Try Again button.
6. IF the camera is disconnected while the Capture_Screen is open, THEN THE Capture_Screen SHALL display a message stating that the camera was disconnected, and a Try Again button.
7. IF the camera is disconnected while a Session is running, THEN THE Capture_Screen SHALL discard the partial Photos.
8. IF the page is not served from a secure context, THEN THE Capture_Screen SHALL display a message stating that HTTPS or localhost is required, and SHALL send no camera request.
9. WHEN the Try Again button is pressed, THE Camera_Service SHALL release the previous stream and send exactly one camera request without reloading the page.
10. WHILE a camera request from the Try Again button is pending, THE Capture_Screen SHALL disable the Try Again button.
11. IF the requested camera constraints cannot be satisfied (OverconstrainedError), THEN THE Camera_Service SHALL retry exactly once with default video constraints, and IF the retry fails, THEN THE Capture_Screen SHALL display the error of the retry.

### Requirement 3: Capture options

Baseline: Not started. The countdown is fixed at 3 s. Back currently exits during a session; Requirement 9 replaces that behavior.

**User Story:** As a user, I want to choose the timer, cancel a session and switch cameras, so that I can pose comfortably and stop when I want.

#### Acceptance Criteria

1. THE Capture_Screen SHALL offer countdown choices of 3 seconds, 5 seconds and 10 seconds, with 3 seconds selected by default.
2. WHEN the user selects a countdown choice, THE Capture_Screen SHALL use that duration for all shots of the next Session, and SHALL keep the choice until the user changes it or leaves the Photobooth.
3. WHILE a Session is running, THE Capture_Screen SHALL display a visible Cancel button.
4. WHEN the Cancel button is pressed during a Session, THE Capture_Screen SHALL stop the countdown within 500 ms, discard the captured Photos, keep the camera preview active and re-enable the Start button.
5. WHILE a Session is running, THE Capture_Screen SHALL disable the countdown choices and the Switch Camera button.
6. WHERE the device reports more than one video input, THE Capture_Screen SHALL display a Switch Camera button.
7. WHEN the Switch Camera button is pressed, THE Camera_Service SHALL stop the current stream and start the next video input in list order, and SHALL return to the first video input after the last one.
8. WHERE the active camera is the user-facing camera, THE Capture_Screen SHALL mirror the preview and the saved Photos, and WHERE the active camera is the rear camera, THE Capture_Screen SHALL display and save them unmirrored.
9. IF switching the camera fails, THEN THE Capture_Screen SHALL display an error message and a Try Again button.

### Requirement 4: Single-photo retake

Baseline: Not started. The Retake button restarts all 4 Photos. There is no Session_Date.

**User Story:** As a user, I want to retake just one photo, so that I do not need to redo the whole strip because of one bad shot.

#### Acceptance Criteria

1. THE Editor_Screen SHALL provide one Retake control for each of the 4 Photos, labelled 1 to 4 in Strip order.
2. WHEN a per-photo Retake control is pressed, THE Photobooth SHALL open the Capture_Screen in Single_Shot_Mode for that Photo position.
3. WHILE the Capture_Screen is in Single_Shot_Mode, THE Capture_Screen SHALL run one countdown of the selected duration and capture exactly 1 Photo of 960x720 pixels.
4. WHEN a single-shot capture completes, THE Photobooth SHALL replace only the selected Photo and return to the Editor_Screen with the Frame_Design, Filter, Caption, Date_Stamp setting and every Sticker_Transform unchanged.
5. WHEN a single-shot capture completes, THE Editor_Screen SHALL apply the current Filter to the new Photo and SHALL keep the original Session_Date.
6. WHEN the user cancels a single-shot capture, THE Photobooth SHALL return to the Editor_Screen with all 4 Photos and all Editor_Screen settings unchanged.
7. IF the camera fails during Single_Shot_Mode, THEN WHEN the user presses the Back button, THE Photobooth SHALL return to the Editor_Screen with all 4 Photos and all Editor_Screen settings unchanged.
8. THE Editor_Screen SHALL provide a Retake All control that starts a new 4-photo Session with a new Session_Date.

### Requirement 5: Strip footer caption and date

Baseline: Not started. The 200 px Footer is reserved and blank.

**User Story:** As a user, I want a caption and date on my strip, so that each strip records the moment.

#### Acceptance Criteria

1. THE Editor_Screen SHALL provide a text input for the Caption that accepts 0 to 40 characters and rejects input beyond 40 characters.
2. WHEN the Caption changes, THE Editor_Screen SHALL redraw the Strip within 1 second with the Caption horizontally centered in the Footer.
3. THE Editor_Screen SHALL provide a toggle to show or hide the Date_Stamp, with the Date_Stamp shown by default.
4. WHEN the Date_Stamp is shown, THE Editor_Screen SHALL draw the Session_Date in the Footer in the format "MMM D, YYYY", with the English 3-letter month, no leading zero on the day and a 4-digit year (for example "Nov 13, 2026").
5. THE Date_Stamp formatter SHALL be a pure function exported from its module.
6. FOR ALL valid dates, formatting a date with the Date_Stamp formatter and parsing the result SHALL produce the same year, month and day (round-trip property).
7. WHEN the Caption is wider than the Strip width minus 60 px padding on each side at the default font size, THE Editor_Screen SHALL reduce the font size until the text fits, down to a minimum of 16 px.
8. WHEN the Caption does not fit at a font size of 16 px, THE Editor_Screen SHALL truncate the Caption with an ellipsis.
9. WHEN both the Caption and the Date_Stamp are shown, THE Editor_Screen SHALL draw the Caption above the Date_Stamp with no overlap inside the 200 px Footer.
10. WHEN the Caption is empty and the Date_Stamp is hidden, THE Editor_Screen SHALL show only the Frame_Design background and any Stickers in the Footer.
11. THE Editor_Screen SHALL draw the Caption and the Date_Stamp in a color with a contrast ratio of at least 4.5:1 against the frame color, and WHERE the Frame_Design is a pattern or a gradient, against the lowest-contrast point of the Footer.
12. WHEN the user changes the Caption or the Date_Stamp setting, THE Editor_Screen SHALL include the change in the next export.

### Requirement 6: Frame designs and stickers

Baseline: Partial. Done: 10 solid colors and the custom color picker (preserve). Missing: patterns, gradients and all Sticker features.

**User Story:** As a user, I want more frame styles and stickers, so that I can make the strip match my mood.

#### Acceptance Criteria

1. THE Editor_Screen SHALL offer at least 6 Frame_Designs in addition to the existing 10 solid colors, including at least 2 patterns and at least 2 gradients.
2. WHEN a Frame_Design is selected, THE Editor_Screen SHALL redraw the Strip within 1 second with that design behind the 4 Photos and the Footer, and SHALL mark the selected design.
3. THE Editor_Screen SHALL keep the custom color picker for solid frame colors, and WHEN the user picks a custom color, THE Editor_Screen SHALL use that color in place of the selected Frame_Design.
4. THE Editor_Screen SHALL keep every Photo_Area unchanged when the Frame_Design changes.
5. THE Editor_Screen SHALL offer at least 6 Stickers drawn from locally bundled assets.
6. WHEN the user chooses a Sticker from the Sticker set, THE Editor_Screen SHALL add the Sticker at the valid position nearest to the center of the Strip, or in the Footer, at default size with no rotation and no flip, fully inside the Strip bounds and outside every Photo_Area, and SHALL make the Sticker the Selected_Sticker.
7. WHEN the user drags a Sticker with a mouse, touch or pen, THE Editor_Screen SHALL move the Sticker to follow the pointer while keeping the whole Sticker inside the Strip bounds and outside every Photo_Area.
8. WHILE the user drags a Sticker toward a Photo_Area, THE Editor_Screen SHALL stop the Sticker at the edge of the Photo_Area and slide the Sticker along the border, so that the Sticker covers no part of any Photo at any moment of the drag.
9. THE Editor_Screen SHALL let the user resize the Selected_Sticker between 25% and 300% of its default size with a size slider and, on a touch device, with a two-finger pinch.
10. THE Editor_Screen SHALL let the user rotate the Selected_Sticker to any angle from 0 to 359 degrees with a rotation slider and, on a touch device, with a two-finger twist.
11. IF a resize or a rotation would make the Selected_Sticker overlap a Photo_Area or leave the Strip bounds, THEN THE Editor_Screen SHALL reject the change or clamp the value to the last valid value.
12. THE Editor_Screen SHALL provide a Flip control that mirrors the Selected_Sticker horizontally, and pressing the Flip control twice SHALL restore the original orientation.
13. THE Editor_Screen SHALL provide a Delete control for the Selected_Sticker and a Remove All control that removes all Stickers from the Strip.
14. WHEN the user taps or clicks an area of the Strip with no Sticker, THE Editor_Screen SHALL clear the Selected_Sticker.
15. THE Editor_Screen SHALL limit the Strip to a maximum of 10 Stickers.
16. IF the user chooses a Sticker while the Strip holds 10 Stickers, THEN THE Editor_Screen SHALL display a message stating that the 10-Sticker limit is reached and SHALL leave the Stickers unchanged.
17. IF the user chooses a Sticker and no valid position exists, THEN THE Editor_Screen SHALL display a message stating that no space is available and SHALL leave the Stickers unchanged.
18. THE Editor_Screen SHALL draw Stickers after the Filter, so that the Filter does not change Sticker pixels.
19. WHEN the Strip is exported, THE Editor_Screen SHALL draw each Sticker at the same Sticker_Transform shown on screen, regardless of the display scale in Requirement 10 criterion 7, and SHALL draw no selection outlines or handles in any exported file.
20. WHILE the user drags a Sticker on a touch device, THE Editor_Screen SHALL prevent the page from scrolling.
21. THE Editor_Screen SHALL let the user move the Selected_Sticker with the arrow keys in steps of 10 px of Strip canvas coordinates, resize the Selected_Sticker with the + and - keys, and operate rotate, flip and delete with buttons that have accessible names, with every keyboard action following criterion 11 and criterion 7.
22. WHEN the Frame_Design, the Filter or the Photos change, THE Editor_Screen SHALL keep every Sticker_Transform unchanged.
23. THE Sticker_Placement_Function SHALL be a pure function exported from its module.

### Requirement 7: Filters

Baseline: Partial. Done: None, B&W, Sepia and Warm run on pixel data, apply to the Photo_Areas only, are non-destructive and leave alpha unchanged (preserve). Missing: Cool, Vintage, High Contrast, Soft Fade and pure exported functions.

**User Story:** As a user, I want more filter options, so that I can pick a look I like.

#### Acceptance Criteria

1. THE Editor_Screen SHALL offer the Filters None, B&W, Sepia, Warm, Cool, Vintage, High Contrast and Soft Fade, with None as the default.
2. WHEN a Filter is selected, THE Editor_Screen SHALL apply the Filter to the 4 Photo_Areas only and leave the frame, Footer and Sticker pixels unchanged.
3. THE Filters SHALL be pure functions exported from modules outside Editor.jsx.
4. FOR ALL pixel arrays, every Filter SHALL return integer values from 0 to 255 and SHALL leave the array length unchanged.
5. FOR ALL pixel arrays, every Filter SHALL leave the alpha channel values unchanged.
6. FOR ALL pixel arrays, every Filter SHALL return the same output for the same input (determinism).
7. FOR ALL pixel arrays, the None Filter SHALL return values identical to the input.
8. FOR ALL pixel arrays, the B&W Filter SHALL produce pixels whose red, green and blue values are equal, and applying B&W twice SHALL produce the same result as applying it once (idempotence).
9. THE Editor_Screen SHALL apply every Filter from the original Photos, so that selecting None restores the original Photos exactly.
10. WHEN a Filter is selected, THE Editor_Screen SHALL complete the redraw within 1000 ms on a Supported_Browser.

### Requirement 8: Export and share

Baseline: Partial. Done: PNG download at full canvas resolution through toBlob (preserve). Missing: timestamped file name, Share, Print_Sheet and export error messages.

**User Story:** As a user, I want to save and share my strip in several ways, so that I can use it on my phone or print it.

#### Acceptance Criteria

1. WHEN the Download button is pressed, THE Editor_Screen SHALL save the Strip as a PNG file at the full canvas resolution that includes everything shown on the Strip, with no selection outlines or handles.
2. THE Editor_Screen SHALL name the downloaded file "lilim-strip-YYYYMMDD-HHmmss.png" using the 24-hour local time of the download.
3. WHERE the browser can share PNG files through the Web Share API, THE Editor_Screen SHALL display a Share button.
4. WHEN the Share button is pressed, THE Editor_Screen SHALL share the Strip PNG file through the Web Share API.
5. IF the user dismisses the share sheet, THEN THE Editor_Screen SHALL remain on the Editor_Screen without displaying an error.
6. IF sharing fails for a reason other than user dismissal, THEN THE Editor_Screen SHALL display a message that names Download as the alternative.
7. IF the canvas cannot be converted to a PNG file, THEN THE Editor_Screen SHALL display an error message, save no file and leave the Editor_Screen state unchanged.
8. THE Editor_Screen SHALL provide a Download Print Sheet button that saves the Print_Sheet as a PNG file of exactly 1200x1800 px.
9. THE Print_Sheet SHALL contain the Strip uniformly scaled to the largest size that fits in the sheet, centered on a white background and never cropped.
10. IF the Print_Sheet cannot be created, THEN THE Editor_Screen SHALL display an error message and save no file.

### Requirement 9: Navigation guards

Baseline: Not started. There is no browser-history integration.

**User Story:** As a user, I want a warning before I lose my photos and a Back button that stays inside the app, so that I do not discard a strip by accident.

#### Acceptance Criteria

1. THE Photobooth SHALL integrate the browser history so that each screen change creates a history entry.
2. WHEN the user presses the browser Back button on the Capture_Screen with no Session running, THE Photobooth SHALL navigate to the Landing_Screen, or to the Editor_Screen WHILE the Capture_Screen is in Single_Shot_Mode.
3. WHEN the user presses the browser Back button during a Session, THE Photobooth SHALL cancel the Session in the same way as the Cancel button.
4. WHILE the Photobooth is in the Unsaved_State, WHEN the user presses the browser Back button on the Editor_Screen, THE Photobooth SHALL display the Confirmation_Dialog.
5. WHILE the Photobooth is in the Unsaved_State, WHEN the user presses Retake All, THE Photobooth SHALL display the Confirmation_Dialog.
6. WHEN the user presses Escape while the Confirmation_Dialog is displayed, THE Photobooth SHALL treat the key press as the Keep button.
7. WHEN the user presses the Discard button, THE Photobooth SHALL discard the Photos and show the Capture_Screen in the ready state.
8. WHEN the user presses the Keep button, THE Photobooth SHALL keep the Photos and remain on the Editor_Screen.
9. WHILE the Photobooth is in the Unsaved_State, WHEN the user tries to close or reload the tab, THE Photobooth SHALL trigger the browser's beforeunload prompt.
10. WHILE the Photobooth is not in the Unsaved_State, THE Photobooth SHALL display no Confirmation_Dialog and trigger no beforeunload prompt.
11. WHEN the user presses a per-photo Retake control, THE Photobooth SHALL display no Confirmation_Dialog.

### Requirement 10: Responsiveness

Baseline: Partial. Done and preserved: mobile-first CSS, 100dvh, 44 px swatches and chips, 900 px breakpoint, 4:3 camera preview. Not done or not verified: the 320 to 1920 px check, safe-area insets, short landscape layout, keeping Photos on resize.

**User Story:** As a user, I want the app to fit my phone, tablet or laptop, so that I can use it anywhere.

#### Acceptance Criteria

1. THE Photobooth SHALL display all screens without horizontal scrolling at viewport widths from 320 px to 1920 px.
2. THE Photobooth SHALL size interactive controls to at least 44x44 CSS pixels on viewports narrower than 900 px, including swatches, chips and Sticker controls.
3. WHILE the viewport is in landscape orientation with a height below 500 px, THE Capture_Screen SHALL keep the camera preview, the countdown, the Start button and the Cancel button visible without vertical scrolling.
4. WHILE the viewport is narrower than 900 px, THE Editor_Screen SHALL display the Strip above the controls, and WHILE the viewport is 900 px or wider, THE Editor_Screen SHALL display the Strip beside the controls.
5. THE Photobooth SHALL keep text and controls outside the device safe-area insets.
6. THE Capture_Screen SHALL show the whole camera preview at a 4:3 aspect ratio without cropping or distortion.
7. THE Editor_Screen SHALL scale the displayed Strip uniformly to fit the viewport while the exported resolution stays at 1080x3230 px.
8. WHEN the viewport is resized or the device is rotated during a Session, THE Capture_Screen SHALL keep the captured Photos.

### Requirement 11: Accessibility, reduced motion and metadata

Baseline: Minimal. Done: html lang="en", viewport meta, aria-labels on swatches and the color input (preserve).

**User Story:** As a user, I want the app to be usable with a keyboard and screen reader and to respect my motion settings, so that it is comfortable for everyone.

#### Acceptance Criteria

1. THE Photobooth SHALL let the user move focus with Tab in reading order and activate every control with Enter or Space, with no keyboard trap.
2. THE Photobooth SHALL display a focus indicator at least 2 px wide with a contrast ratio of at least 3:1 on every focused control.
3. THE Photobooth SHALL provide a non-empty accessible name for every button, swatch, chip, toggle, slider and input.
4. WHEN the countdown value or the "photo N of 4" progress changes, THE Capture_Screen SHALL announce the new value through a polite ARIA live region.
5. WHEN an error message is displayed, THE Photobooth SHALL announce the message through an element with role "alert".
6. THE Strip canvas SHALL have a text alternative that states the photo count, the Filter, the Frame_Design, the Caption, the Date_Stamp and the Sticker count, and THE Editor_Screen SHALL update the text alternative when any of these change.
7. THE Photobooth SHALL use text colors with a contrast ratio of at least 4.5:1 and user interface component colors with a contrast ratio of at least 3:1 against their backgrounds.
8. WHILE the Reduced_Motion_Preference is active, THE Photobooth SHALL disable the countdown animation, the flash animation and screen transitions, and THE Capture_Screen SHALL continue to show and announce the countdown values.
9. THE Photobooth SHALL include a favicon, a meta description of 1 to 160 characters, and a theme-color meta tag that matches the Web_Manifest theme color in index.html.
10. THE Photobooth SHALL continue to set the html lang attribute to "en" (preserve).
11. WHEN a download, share or Print_Sheet export succeeds, THE Editor_Screen SHALL announce the success through an ARIA live region.
12. THE Photobooth SHALL display the name "Lilim" as the Landing_Screen title and the document title, and SHALL use "Lilim" as the Web_Manifest name and short_name.

### Requirement 12: Privacy

Baseline: Behavior holds, not verified. The code makes no network calls and no storage writes. The Landing privacy statement is missing.

**User Story:** As a user, I want my photos to stay on my device, so that nobody else can see them.

#### Acceptance Criteria

1. THE Photobooth SHALL send no camera, Photo, Strip or Print_Sheet data to the network, localStorage, sessionStorage, IndexedDB, cookies or the Service_Worker cache.
2. THE Photobooth SHALL write a file only when the user presses Download, Share or Download Print Sheet.
3. THE Photobooth SHALL make no request to any other origin at runtime and SHALL include no analytics.
4. WHEN the user discards the Photos, cancels a Session or starts a new Session, THE Photobooth SHALL release all references to the Photos, the Strip and the Print_Sheet within 1 second.
5. IF a Session ends before completion, THEN THE Photobooth SHALL keep no copy of the captured Photos.
6. THE Landing_Screen SHALL display a privacy statement of at most 120 characters stating that photos stay on the device, visible without any user interaction.

### Requirement 13: Dependency cleanup

Baseline: Not done. @supabase/supabase-js and qrcode.react are installed with npm default version ranges. The .env file may contain VITE_SUPABASE_* entries.

**User Story:** As the developer, I want unused dependencies and placeholder configuration removed, so that the project is small and has no misleading setup.

#### Acceptance Criteria

1. THE Photobooth project SHALL contain no @supabase/supabase-js and no qrcode.react in package.json and package-lock.json.
2. THE Photobooth project SHALL contain no VITE_SUPABASE_* entries in the .env file.
3. THE Photobooth project SHALL contain zero case-insensitive matches for "supabase" and for "qrcode.react" in src/ and index.html.
4. WHEN `npm ci` and then `npm run build` are run after the cleanup, THE commands SHALL exit with code 0.
5. THE Photobooth project SHALL list the .env file in .gitignore and SHALL not track the .env file in version control.
6. THE Photobooth project SHALL pin every dependency in package.json, including dependencies added later, to an exact version with no ^, ~, >, <, *, x or "latest".

### Requirement 14: Tests

Baseline: Not started. There is no test runner, no tests and no `npm test` script.

**User Story:** As the developer, I want automated tests for the core logic, so that I can change code without breaking it.

#### Acceptance Criteria

1. THE Photobooth project SHALL include a test runner and an `npm test` script that runs all tests once without watch mode, exits with code 0 when all tests pass and exits with a non-zero code when a test fails.
2. THE Crop_Function, the Filters, the Date_Stamp formatter and the Sticker_Placement_Function SHALL run in tests without a camera, a network or a browser.
3. THE test suite SHALL run each property-based test with at least 100 generated cases.
4. THE test suite SHALL include property-based tests for the Crop_Function that verify the 4:3 ratio, containment within the frame and centering.
5. THE test suite SHALL include property-based tests for the Filters that verify output range, unchanged length, unchanged alpha and determinism.
6. THE test suite SHALL include a property-based test that verifies the None Filter is the identity, and a property-based test that verifies the B&W Filter produces equal red, green and blue values and is idempotent.
7. THE test suite SHALL include a property-based test for the Date_Stamp formatter that verifies the format pattern and the round-trip of year, month and day.
8. THE test suite SHALL include a property-based test for the Sticker_Placement_Function that verifies, for any generated Sticker_Transform and drag target, that the Sticker stays inside the Strip and overlaps no Photo_Area.
9. THE test suite SHALL include component tests, using a mocked camera API, that verify a distinct message for denied permission, no camera found, camera in use, camera disconnected and insecure context.
10. THE test suite SHALL include component tests that verify each press of the Try Again button sends exactly one camera request.
11. THE test suite SHALL include a test that verifies the Offline_Indicator is shown without a network connection and removed when the connection returns.
12. WHEN `npm ci` and then `npm test` are run on a clean checkout, THE test suite SHALL pass with zero failed tests and zero skipped tests.

### Requirement 15: README

Baseline: Not started. README.md exists with no written content.

**User Story:** As the developer, I want a README, so that I can remember how to run, build, test and deploy the app later.

#### Acceptance Criteria

1. THE README SHALL describe what the Photobooth does in at most 3 sentences.
2. THE README SHALL list the features, one feature per line.
3. THE README SHALL list the exact commands to install, run in development, build, preview and test the project, each with a one-line description.
4. THE README SHALL state that the camera requires HTTPS or localhost.
5. THE README SHALL include the full privacy statement from Requirement 12.
6. THE README SHALL describe the deployment steps, including how to set the base path for a sub-path host.
7. THE README SHALL describe the PWA install steps for Chrome and Edge on desktop, Chrome on Android and Safari on iOS.
8. THE README SHALL state that offline use requires one prior online load.
9. THE README SHALL list the Supported_Browsers and the known limitations.

### Requirement 16: Deployment

Baseline: Not started. The repository is on GitHub. The app is not deployed and has no hosting configuration. The owner leaves the host unnamed.

**User Story:** As the developer, I want to publish the app on an HTTPS host, so that the camera works on my phone and I can share the link.

#### Acceptance Criteria

1. WHEN `npm run build` is run, THE Photobooth project SHALL produce a dist folder that contains index.html and needs no server-side code.
2. THE Photobooth project SHALL include a Hosting_Configuration for exactly one static HTTPS host chosen by the owner, and THE README SHALL name the host once the owner has chosen it.
3. WHERE the app is hosted under a sub-path, THE Vite configuration SHALL set the base path so that all assets, the Web_Manifest start_url and scope, and the Service_Worker scope resolve with no 404 responses.
4. WHEN the deployed site is opened over HTTPS on a mobile Supported_Browser and the user grants camera permission, THE Capture_Screen SHALL show the camera preview within 5 seconds of the grant.
5. IF the site is requested over plain HTTP, THEN THE Hosting_Configuration SHALL redirect the request to HTTPS on the same path.
6. THE Hosting_Configuration SHALL make the browser revalidate the Service_Worker file on every load.
7. THE Hosting_Configuration SHALL serve the Web_Manifest and the Service_Worker file with correct content types.

### Requirement 17: Offline support and installable PWA

Baseline: Not started. There is no PWA plugin.

**User Story:** As a user, I want to install the app and use it without internet after my first visit, so that I can run the photobooth anywhere.

#### Acceptance Criteria

1. THE Photobooth project SHALL register a Service_Worker that precaches the HTML, JavaScript, CSS, fonts, icons, images and the Web_Manifest.
2. WHEN the app is launched with no network connection after one activated online load, THE Photobooth SHALL show the Landing_Screen within 3 seconds.
3. WHILE the device has no network connection, THE Photobooth SHALL provide capture, single-photo retake, Filters, Frame_Designs, Stickers, Caption, Date_Stamp, PNG download and Print_Sheet download with the same behavior as when online.
4. WHILE the device has no network connection, THE Editor_Screen SHALL keep the Share button available where Requirement 8 criterion 3 applies, and SHALL handle share failure as in Requirement 8 criterion 6.
5. THE Photobooth SHALL bundle all fonts, icons and images locally and SHALL make no request to a CDN or third-party origin.
6. THE Web_Manifest SHALL contain the name "Lilim", the short_name "Lilim", a start_url, the standalone display mode, a theme color, a background color, icons of 192x192 and 512x512 pixels and at least one maskable icon.
7. THE Photobooth SHALL meet the browser installability criteria on a Supported_Browser.
8. WHILE the device has no network connection, THE Offline_Indicator SHALL be displayed within 2 seconds, contain text, meet a contrast ratio of at least 4.5:1 and leave every control operable.
9. WHEN the network connection returns, THE Offline_Indicator SHALL be removed within 2 seconds.
10. WHEN the Service_Worker detects a new deployed version, THE Photobooth SHALL display the Update_Prompt with a Reload button within 5 seconds, and SHALL not reload the page automatically.
11. WHEN the Reload button is pressed, THE Photobooth SHALL activate the new Service_Worker and reload the page within 5 seconds.
12. WHILE a Session is running or the Photobooth is in the Unsaved_State, WHEN the Reload button is pressed, THE Photobooth SHALL display the Confirmation_Dialog from Requirement 9 before reloading.
13. THE Service_Worker cache SHALL exclude Photo, Strip and Print_Sheet data.
14. WHERE the page is served over HTTPS or from localhost, THE Photobooth SHALL register the Service_Worker, and IF the page is served from any other origin, THEN THE Photobooth SHALL skip registration and continue to run.
15. IF Service_Worker registration fails, THEN THE Photobooth SHALL continue to run without blocking use.
16. IF an update check fails while the device is offline, THEN THE Photobooth SHALL display nothing.
