import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // CHANGED from 'autoUpdate'. With 'autoUpdate' the plugin reloads the page
      // by itself as soon as a new service worker is ready, so the
      // "Restart and install / Later" popup never appears and a user can be
      // reloaded in the middle of filling a form.
      registerType: 'prompt',

      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'National Child Health Program',
        short_name: 'NCHP',
        description: 'Program & Course Monitoring System',
        theme_color: '#0284c7',
        background_color: '#f0f9ff',
        // child.png is a single 2362x2362, 479 KB image that was declared at
        // both icon sizes, so every install downloaded half a megabyte for a
        // launcher icon. These are the same artwork resized properly.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/\.apk$/, /\.json$/, /^\/__\//],

        // Deletes caches left by older Workbox versions. Without this, old
        // precache entries stay on the device forever and can be served
        // instead of the new build.
        cleanupOutdatedCaches: true,

        // PRECACHE THE SHELL ONLY.
        //
        // This used to glob every built file with a 12 MiB per-file ceiling,
        // which meant the service worker downloaded ~15 MB on install — every
        // lazy route, the map data and the spreadsheet libraries — and again
        // after each release. On the mobile networks this app runs on, that
        // download often never finished.
        //
        // Now only what is needed to start the app is precached; route chunks
        // arrive with the screen that needs them and are cached on first use,
        // so they are still available offline afterwards.
        // The firebase chunk is a static import of the entry, so it has to be
        // present for the app to boot offline. splash.png is a copy of the
        // source artwork used only to generate the native splash screens; it is
        // 479 KB and the web app never renders it.
        globPatterns: [
          'index.html',
          'manifest.webmanifest',
          'assets/app-*.js',
          'assets/firebase-*.js',
          'assets/*.css',
          'icon-*.png',
          'favicon.ico',
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,

        runtimeCaching: [
          {
            // Route chunks and shared vendor chunks: serve from cache, refresh
            // in the background. This is what makes the app work offline
            // without paying for everything up front.
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-chunks',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Map data: large, and it changes about once a year.
            urlPattern: ({ url }) => url.pathname.startsWith('/geo/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'geo-data',
              expiration: { maxEntries: 8, maxAgeSeconds: 180 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|woff2?|ttf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Never cache the update manifest: a cached copy would hide new versions.
            urlPattern: /\/latest\/update\.json$/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  base: '/',
  define: {
    // The app version now comes from package.json, so you only bump it in one
    // place. Before, VITE_APP_VERSION was never set and the code fell back to a
    // hard-coded '1.0.2' that did not match package.json's 1.0.0.
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),

    FIREBASE_WEBAPP_CONFIG: process.env.FIREBASE_WEBAPP_CONFIG
      ? JSON.stringify(JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG))
      : "undefined",
  },
  build: {
    // manualChunks used to force chart.js, jspdf and leaflet into named chunks.
    // Rollup then made all three static imports of the entry chunk, so ~1.9 MB
    // was downloaded before the login screen could render — undoing most of the
    // lazy() work in App.jsx. Rollup's default splitting follows the dynamic
    // imports, which is what we want; only Firebase is grouped, because every
    // screen needs it and it is worth one long-lived cached file.
    rollupOptions: {
      output: {
        // The entry gets a distinct name so the service worker can precache it
        // by pattern. Vite names chunks after their module, and several lazy
        // routes live in files called index.jsx — so an `assets/index-*` glob
        // silently precached those route chunks too.
        entryFileNames: 'assets/app-[hash].js',
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
