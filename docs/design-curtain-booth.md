# Lilim visual design: "Curtain booth"

Status: proposal, not yet implemented. Scope: look and feel only. No logic changes.

## Concept
Lilim means shade. The app is the inside of a photo booth: a dark, curtained room
with one lit object, the photo strip. Controls recede. The strip is the hero.

## Palette (CSS variables)
| Token | Value | Use |
|---|---|---|
| --bg | #1c0f10 | page background (ink-oxblood) |
| --curtain | #4a1218 | landing curtain, large accents |
| --surface | #2a1517 | control panel, dialogs |
| --border | #5a3a38 | 1px hairlines |
| --paper | #f4ecdd | text on dark, strip paper |
| --muted | #b9a8a0 | secondary text |
| --accent | #f2b632 | the only accent: primary button, active state, flash |
| --on-accent | #1c0f10 | text on accent |
| --focus | #ffd45e | focus ring (3 px) |

Rules: one accent only. No gradients on UI chrome. No emoji. No blur-heavy shadows;
the only soft shadow is the glow/shadow around the strip.
Contrast targets (checked by src/test/a11y.test.js, which must be updated to the new
tokens): paper on bg, muted on bg, on-accent on accent at 4.5:1 or more; focus and
border on bg at 3:1 or more.

## Type
- Display: Fraunces (variable serif) for the title, headings and countdown numeral.
- UI: Instrument Sans (or system-ui fallback) for controls and body.
- Mono: system monospace for labels like "01/04" and the date stamp.
- Fonts are bundled with exact-pinned @fontsource packages. No Google Fonts link:
  the app must make no network requests and must work offline (R12, R17).
- Scale: 12 / 14 / 16 / 20 / 28 / 44 / 96 px. Labels are 12 px uppercase, 0.08em tracking.

## Shape and spacing
- Radius: 2 px on controls, 0 on the strip. No pills, no circles except swatches.
- Spacing unit 8 px. Controls stay at least 44 px high.
- Borders: 1 px --border. Active state: 1 px --accent border plus accent text or fill.

## Screens

### Landing
- Full-bleed --curtain with vertical fold shading (repeating-linear-gradient, CSS only),
  parted slightly in the center showing --bg.
- Title "Lilim" in Fraunces 96 px, paper color. Tagline in muted 16 px.
- One primary button "Step inside" (accent, rectangular). Keep the privacy line,
  muted, 14 px: "Your photos stay on this device. Nothing is uploaded."
- On press: curtains slide apart (about 500 ms), then Capture appears.
  prefers-reduced-motion: no animation, instant switch.

### Capture
- Dark room. The camera preview is a rectangle with a thin paper border (like a mirror
  frame), 4:3, centered.
- Countdown: giant Fraunces numeral over the preview, no text shadow box.
- Flash: brief paper-colored overlay, 120 ms (none under reduced motion).
- Progress label in mono: "01 / 04".
- Controls in a slim bar below: timer (3 / 5 / 10 as a segmented control), Switch
  camera, Start (accent), Cancel, Back (text button).
- Errors: a surface panel with a paper left border, plain language, Try Again button.

### Editor
- Desktop (900 px and up): strip centered-left on a "stage" with a soft shadow and a
  faint spotlight (radial gradient of --curtain at low opacity). Controls in a fixed
  --surface side panel, 360 px wide, scrolling inside itself.
- Mobile: strip on top, controls below as the same panel.
- Controls become tabs (text tabs with an accent underline): Frame, Filter, Stickers,
  Caption. Only one group is visible at a time, which removes the long scroll.
- Retake: a "Retake" row of four small square buttons labeled 1 to 4, plus "Retake all".
- Frame swatches: 36 px squares with 2 px radius and a paper outline when selected;
  patterns and gradients shown as small previews, not text pills.
- Filters: text chips in a single wrapping row, active one filled accent.
- Primary actions pinned at the bottom of the panel: Download (accent), Share,
  Print sheet (outlined).
- Date stamp on the strip: mono, slightly faded, as already rendered by the canvas.

## Strip frames (separate from UI)
Replace the candy defaults with a calmer set while keeping ids and the contrast rule
(text color must reach 4.5:1 on every built-in frame, tested in frames.test.js):
paper, ink, oxblood, forest, navy, mustard, blush, plus the patterns and gradients
re-tinted to this palette. Custom color picker stays.

## Motion (three things only)
1. Curtain parts on Landing.
2. Flash on capture.
3. Strip slides up into the Editor (200 ms).
All disabled under prefers-reduced-motion.

## Implementation plan
1. Add pinned @fontsource packages, import in main.jsx.
2. Rewrite src/index.css with the tokens above (keep class names where possible).
3. Markup changes: Landing.jsx (curtain), Capture.jsx (progress label, segmented timer),
   Editor.jsx (tabs, retake row, pinned actions).
4. Update FRAMES palette in src/lib/frames.js.
5. Update a11y.test.js to the new tokens; run the full suite and the build.
6. Check by eye at 360, 768 and 1440 px, and with reduced motion on.

## Open choices
- Fraunces vs another serif (for example DM Serif Display).
- Whether the Landing curtain animation is worth the extra markup.
- Dark editor panel vs a light paper panel for better print-like feel.
