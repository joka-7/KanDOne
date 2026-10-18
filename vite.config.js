import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import { chunkFileName, NATIVE_ONLY_PRECACHE_IGNORES } from './scripts/pwa-chunks.js'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico', 'apple-touch-icon-180x180.png',
        'pwa-64x64.png', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon-512x512.png',
      ],
      manifest: {
        id: '/',
        name: 'KanDOne',
        short_name: 'KanDOne',
        description: 'KanDOne — Kanban task board: plan work in steps and track progress',
        theme_color: '#059669',
        background_color: '#f8fafc',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['**/icon-master.png', ...NATIVE_ONLY_PRECACHE_IGNORES],
        // The privacy page is a separate static file; without this an installed
        // app would answer the navigation with index.html.
        navigateFallbackDenylist: [/^\/privacy\.html$/],
      },
    }),
    // Opt-in: `npm run build:analyze` writes dist/stats.html (not run in CI).
    process.env.ANALYZE === '1' && visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      // Names the Android sign-in plugin's chunks so the service worker can skip
      // them (see scripts/pwa-chunks.js); `npm run check:precache` verifies it.
      output: { chunkFileNames: chunkFileName },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      // istanbul, not v8: v8 parses uncovered files with rolldown to report
      // them at 0%, and rolldown cannot parse JSX — so any component without a
      // test crashes the run. istanbul instruments through Vite's own
      // pipeline, which already handles JSX.
      provider: 'istanbul',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**'],
      exclude: ['src/**/__tests__/**', 'src/main.jsx'],
      // Floors just under the measured lines 47.9, statements 46.7, functions
      // 37.8, branches 36.6, to ratchet up. Raise them when coverage grows.
      // Unit coverage only: the UI paths are covered by the Playwright suite,
      // which does not report here, so this number understates what is tested.
      thresholds: { lines: 46, statements: 45, functions: 36, branches: 35 },
    },
  },
})
