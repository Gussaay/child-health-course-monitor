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
        // `/oauth/`, `/mcp` and `/.well-known/` are Cloud Functions behind
        // Hosting rewrites, not pages of this app. Without them here the
        // service worker answers those navigations with the cached index.html,
        // so the OAuth endpoints appear to return the app instead of doing
        // their job.
        //
        // `connect_claude` is the redirect the authorisation step lands on. It
        // has to come from the network: the whole point of that page is that it
        // is the version just deployed, and serving a precached shell is what
        // made three rounds of fixes look as though they had never shipped.
        navigateFallbackDenylist: [
          /\.apk$/, /\.json$/, /^\/__\//,
          /^\/oauth\//, /^\/mcp$/, /^\/\.well-known\//,
          /[?&]connect_claude=/,
        ],

        // Deletes caches left by older Workbox versions. Without this, old
        // precache entries stay on the device forever and can be served
        // instead of the new build.
        cleanupOutdatedCaches: true,

        // A new service worker takes over as soon as it has downloaded, instead
        // of waiting for every tab to close. A browser stuck on a broken
        // release (see app-chunks below) could otherwise never receive the fix:
        // its page is blank, so the "Restart and install" prompt cannot show.
        // Nothing is reloaded by this — main.jsx offers the restart itself when
        // the new worker takes control.
        skipWaiting: true,
        clientsClaim: true,

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
            //
            // Only real scripts and styles are kept. After a release, a chunk
            // from the previous build no longer exists, and Hosting used to
            // answer that request with index.html and a 200. That page was
            // stored under the chunk's name, so the next start loaded HTML as
            // code and showed a white screen. The cache was renamed so copies
            // poisoned that way are never read again.
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-chunks-v2',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  cacheWillUpdate: async ({ response }) => {
                    if (!response || response.status !== 200) return null;
                    const type = response.headers.get('content-type') || '';
                    return type.includes('text/html') ? null : response;
                  },
                },
              ],
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
