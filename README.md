# Lilim

Lilim is a personal photobooth web app that runs in the browser. You take 4 photos with your camera, then edit and download them as one vertical photo strip. Everything happens on your device, and the app works offline once installed.

## Features

- Capture 4 photos per session with a countdown of 3, 5 or 10 seconds
- Cancel a running session at any time
- Switch between cameras when the device has more than one
- Retake a single photo, or retake all 4
- Add a caption and a date stamp in the strip footer
- Choose a frame design: solid colors, a custom color, patterns and gradients
- Add, move, resize, rotate, flip and delete stickers (up to 10)
- Apply a filter: None, B&W, Sepia, Warm, Cool, Vintage, High Contrast or Soft Fade
- Download the strip as a PNG file
- Share the strip through the Web Share API where the browser supports it
- Download a 1200x1800 px print sheet
- Warning before you lose unsaved photos
- Install as an app (PWA) and use it offline

## Commands

Run these from the project root.

| Command | Description |
| --- | --- |
| `npm ci` | Install the exact dependency versions from `package-lock.json`. |
| `npm run dev` | Start the Vite development server with hot reload. |
| `npm run build` | Build the production site into the `dist` folder. |
| `npm run preview` | Serve the built `dist` folder locally to check the production build. |
| `npm test` | Run the test suite once. |

## Camera requirement

The camera works only on a secure origin: the page must be served over HTTPS or from `localhost`. On plain HTTP the app shows a message and sends no camera request.

## Privacy

Photos stay on the device. The app sends no camera, photo, strip or print sheet data to the network, localStorage, sessionStorage, IndexedDB, cookies or the service worker cache. It writes a file only when you press Download, Share or Download Print Sheet. It makes no request to any other origin at runtime and includes no analytics. When you discard photos, cancel a session or start a new one, the app releases its references to the photos.

The Landing screen shows this short version: "Your photos stay on this device. Nothing is uploaded."

## Deployment

The build output is static files with no server-side code.

1. Run `npm ci`.
2. Run `npm run build`.
3. Upload the contents of the `dist` folder to a static host that serves over HTTPS.

If the site lives under a sub-path (for example `https://example.com/lilim/`), set `BASE_PATH` with leading and trailing slashes when you build. The value is used for asset URLs, the manifest `start_url` and `scope`, and the service worker scope.

```powershell
# PowerShell
$env:BASE_PATH = "/lilim/"; npm run build
```

```bash
# bash
BASE_PATH=/lilim/ npm run build
```

Without `BASE_PATH`, the base path is `/`.

Host: Vercel.

The `vercel.json` file in the project root configures Vercel. It serves `sw.js` as JavaScript with `Cache-Control: public, max-age=0, must-revalidate`, so the browser revalidates it on every load, and serves `manifest.webmanifest` as `application/manifest+json`. It has no catch-all rewrite, so `sw.js` and the manifest are never replaced by `index.html`. Vercel redirects HTTP to HTTPS on the same path by default, so that needs no configuration.

Deploy steps:

1. Push the repository to GitHub, GitLab or Bitbucket.
2. In Vercel, choose Add New, then Project, and import the repository.
3. Keep the detected Vite settings: build command `npm run build`, output directory `dist`.
4. Leave `BASE_PATH` unset when the site is served from the domain root. Vercel gives each project its own domain.
5. Click Deploy. Later pushes to the production branch deploy automatically.

Alternatively, run `npx vercel --prod` from the project root.

## Install as an app (PWA)

- **Chrome on desktop:** open the site, then click the install icon in the address bar, or open the three-dot menu and choose Install Lilim.
- **Edge on desktop:** open the site, then click the install icon in the address bar, or open the menu (...) and choose Apps, then Install this site as an app.
- **Chrome on Android:** open the site, open the three-dot menu, then choose Install app or Add to Home screen.
- **Safari on iOS:** open the site in Safari, tap the Share button, then choose Add to Home Screen and tap Add.

## Offline use

Offline use needs one prior online load. After the first visit loads and caches the app, it opens and works without a network connection. When a new version is deployed, the app offers a prompt to reload into it.

## Supported browsers

The current stable release of Chrome, Edge, Firefox or Safari, on desktop or mobile.

## Known limitations

- The camera needs HTTPS or localhost, and the user must grant camera permission.
- The Share button appears only in browsers that can share PNG files through the Web Share API.
- Stickers cannot cover photos. The sticker area is small: stickers fit only in the footer, the padding around the strip and the gaps between photos.
- Offline use does not work before the first online load.
- Photos are not saved inside the app. Leaving or reloading the page discards them, so download the strip first.
- Installing the app follows the browser's own rules. Firefox on desktop does not offer PWA install.
