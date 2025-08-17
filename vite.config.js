// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa'; // ++ ADD THIS IMPORT ++

export default defineConfig({
  plugins: [
    react(),
    // ++ ADD THIS ENTIRE PLUGIN CONFIGURATION ++
    VitePWA({
      // This setting tells the app to show a prompt when a new version is available.
      registerType: 'prompt', 
      // This manifest provides info for when users "install" the app to their home screen.
      manifest: {
        name: 'NCHP Course Monitor',
        short_name: 'NCHP Monitor',
        description: 'National Child Health Program - Course Monitoring System',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'child-192.png', // You need to create this icon
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'child-512.png', // You need to create this icon
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  base: '/', // This line is required for Firebase Hosting
  define: {
    // Pass through a JSON string for production builds on App Hosting
    FIREBASE_WEBAPP_CONFIG: process.env.FIREBASE_WEBAPP_CONFIG
      ? JSON.stringify(JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG))
      : "undefined"
  }
});