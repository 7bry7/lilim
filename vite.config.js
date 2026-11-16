import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Single source for the manifest colors; must equal the theme-color meta in index.html.
export const THEME_COLOR = '#1c0f10'

const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(), // lets Vite understand JSX
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'Lilim',
        short_name: 'Lilim',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // No runtimeCaching: only build assets are cached.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
})
