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

// =========================================================================
// --- INTELLIGENT INSTANT UPDATE MANAGER (WEB & NATIVE) ---
// =========================================================================
window.pendingPwaUpdate = null;
window.pendingOtaBundleId = null;

// Helper to instantly trigger Native OTA restart
window.applyCapgoUpdate = async (id) => {
    try {
        if (Capacitor.isNativePlatform()) {
            await CapacitorUpdater.set({ id });
        }
    } catch (e) {
        console.error("❌ Capacitor Updater: Failed to apply OTA bundle:", e);
    }
};

// Evaluates safety and applies pending updates instantly
window.checkAndApplyPendingUpdates = async () => {
    // Regex identifies active data-entry routes where a sudden reload would lose data. Added root path `/` for Auth.[cite: 3]
    const isCriticalPath = /(form|submit|observe|test|record|edit|new|update|manager|finalreport|attendance)/i.test(window.location.pathname) || window.location.pathname === '/';
    
    if (!isCriticalPath) {
        // 1. Instantly apply PWA Update (Web)
        if (window.pendingPwaUpdate) {
            console.log("🔄 Safe state detected: Reloading Web PWA instantly.");
            const updateFn = window.pendingPwaUpdate;
            window.pendingPwaUpdate = null;
            updateFn(true); // Triggers skipWaiting and reloads
        }
        // 2. Instantly apply Capgo OTA (Native)
        if (window.pendingOtaBundleId) {
            console.log("🔄 Safe state detected: Waking native app and reloading OTA instantly.");
            const bundleId = window.pendingOtaBundleId;
            window.pendingOtaBundleId = null;
            window.applyCapgoUpdate(bundleId);
        }
    } else {
        console.log("⚠️ Update downloaded and pending, but user is entering data. Waiting for safe navigation or app close to avoid data loss.");
    }
};

// Intercept SPA routing to catch the exact moment a user leaves a critical form
const originalPushState = window.history.pushState;
window.history.pushState = function() {
    originalPushState.apply(this, arguments);
    setTimeout(() => window.checkAndApplyPendingUpdates(), 500); 
};
const originalReplaceState = window.history.replaceState;
window.history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    setTimeout(() => window.checkAndApplyPendingUpdates(), 500);
};
window.addEventListener('popstate', () => {
    setTimeout(() => window.checkAndApplyPendingUpdates(), 500);
});

// Register SW to capture PWA updates immediately and pass them to our manager
const updateSW = registerSW({ 
    onNeedRefresh() {
        console.log("⬇️ PWA Service Worker downloaded new update.");
        window.pendingPwaUpdate = updateSW;
        window.checkAndApplyPendingUpdates();
    },
    immediate: true 
});
// =========================================================================

// =========================================================================
// --- AGGRESSIVE VERSION-CONTROLLED CACHE BUSTER ---
// =========================================================================
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.2';
window.APP_VERSION = APP_VERSION; 

const localVersion = localStorage.getItem('app_version');

if (localVersion !== APP_VERSION) {
  console.log(`🔄 New version detected! Upgrading from ${localVersion || 'unknown'} to ${APP_VERSION}.`);
  if (navigator.onLine) {
      console.log("Clearing cache to fetch fresh files...");
      if ('caches' in window) {
        caches.keys().then((names) => {
          Promise.all(names.map(name => caches.delete(name)))
            .then(() => {
              console.log("✅ All caches successfully deleted.");
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(let registration of registrations) { registration.unregister(); }
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

if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady()
    .then(() => console.log("✅ Capacitor Updater: App booted successfully."))
    .catch((err) => console.error("❌ Capacitor Updater: Failed to notify app ready.", err));
}