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
// ⚠️ IMPORTANT: Change this version string whenever you deploy a new update
// and want to force all users' devices to clear their cache.
const APP_VERSION = '1.0.1'; 

const localVersion = localStorage.getItem('app_version');

if (localVersion !== APP_VERSION) {
  console.log(`🔄 New version detected! Upgrading from ${localVersion || 'unknown'} to ${APP_VERSION}. Clearing cache...`);
  
  if ('caches' in window) {
    caches.keys().then((names) => {
      // Delete ALL caches to ensure a completely fresh start
      Promise.all(names.map(name => caches.delete(name)))
        .then(() => {
          console.log("✅ All caches successfully deleted.");
          
          // Unregister any old service workers directly
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
              for(let registration of registrations) {
                registration.unregister();
              }
            });
          }

          // Update the version in local storage so it doesn't loop
          localStorage.setItem('app_version', APP_VERSION);
          
          // Force a hard reload from the server to pull the new files
          window.location.reload(true);
        });
    });
  } else {
    // If 'caches' API isn't supported, just update version and reload
    localStorage.setItem('app_version', APP_VERSION);
    window.location.reload(true);
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