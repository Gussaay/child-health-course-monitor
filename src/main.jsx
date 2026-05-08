// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

import { DataProvider } from './DataContext'; 
import './index.css';

// --- SERVICE WORKER REGISTRATION ---
import { registerSW } from 'virtual:pwa-register';

// --- UPDATER IMPORTS ---
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';

// Automatically updates the service worker when new content is available
registerSW({ immediate: true });
// ------------------------------------

// =========================================================================
// --- AGGRESSIVE VERSION-CONTROLLED CACHE BUSTER ---
// =========================================================================
const APP_VERSION = '1.0.2';
window.APP_VERSION = APP_VERSION; 

const localVersion = localStorage.getItem('app_version');

if (localVersion !== APP_VERSION) {
  console.log(`🔄 New version detected! Upgrading from ${localVersion || 'unknown'} to ${APP_VERSION}.`);
  
  // CRITICAL FIX: Only wipe caches and force reload if the device is actually online.
  // Doing this while offline will crash the PWA/Native Webview entirely.
  if (navigator.onLine) {
      console.log("Clearing cache to fetch fresh files...");
      if ('caches' in window) {
        caches.keys().then((names) => {
          Promise.all(names.map(name => caches.delete(name)))
            .then(() => {
              console.log("✅ All caches successfully deleted.");
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(let registration of registrations) {
                    registration.unregister();
                  }
                });
              }
              localStorage.setItem('app_version', APP_VERSION);
              window.location.reload();
            });
        });
      } else {
        localStorage.setItem('app_version', APP_VERSION);
        window.location.reload();
      }
  } else {
      console.log("📱 Offline mode. Skipping cache wipe until network is restored to prevent crash.");
      localStorage.setItem('app_version', APP_VERSION);
  }
}
// =========================================================================

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <DataProvider>
    <App />
  </DataProvider>
);

// --- NOTIFY APP READY FOR CAPGO UPDATER ---
if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady().then(() => {
    console.log("Capacitor Updater: App is ready and update is confirmed.");
  }).catch((err) => {
    console.error("Capacitor Updater: Failed to notify app ready.", err);
  });
}