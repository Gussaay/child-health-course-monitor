// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'child.png'], // Assets in your public folder
      manifest: {
        name: 'National Child Health Program',
        short_name: 'NCHP',
        description: 'Program & Course Monitoring System',
        theme_color: '#0284c7', // Matches sky-600 used in your header
        background_color: '#f0f9ff', // Matches sky-50 background
        icons: [
          {
            src: 'child.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'child.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Defines how different file types are cached
        runtimeCaching: [
          {
            // Cache-First for static assets (images, fonts)
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|woff2?|ttf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          }
          // The broad JS/CSS StaleWhileRevalidate block has been REMOVED.
          // VitePWA handles the core app JS/CSS precaching automatically.
        ]
      }
    })
  ],
  base: '/',
  define: {
    FIREBASE_WEBAPP_CONFIG: process.env.FIREBASE_WEBAPP_CONFIG
      ? JSON.stringify(JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG))
      : "undefined"
  }
});