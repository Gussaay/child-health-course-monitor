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

      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'child.png'],
      manifest: {
        name: 'National Child Health Program',
        short_name: 'NCHP',
        description: 'Program & Course Monitoring System',
        theme_color: '#0284c7',
        background_color: '#f0f9ff',
        icons: [
          { src: 'child.png', sizes: '192x192', type: 'image/png' },
          { src: 'child.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/\.apk$/, /\.json$/, /^\/__\//],

        // Deletes caches left by older Workbox versions. Without this, old
        // precache entries stay on the device forever and can be served
        // instead of the new build.
        cleanupOutdatedCaches: true,

        // IMPORTANT: the default limit is 2 MiB, and any built file larger than
        // that is SILENTLY left out of the offline cache. This app bundles
        // exceljs, jspdf, react-pdf, leaflet and chart.js, so the main chunk is
        // well over 2 MiB — which is why the app was not working properly
        // offline. 12 MiB covers it.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,

        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],

        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|woff2?|ttf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
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
    // Splits the heavy libraries into their own files. One huge chunk has to be
    // re-downloaded in full on every update; separate chunks mean users only
    // download what actually changed.
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          charts: ['chart.js', 'react-chartjs-2'],
          pdf: ['jspdf', 'jspdf-autotable'],
          excel: ['exceljs', 'xlsx'],
          maps: ['leaflet', 'react-leaflet'],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
