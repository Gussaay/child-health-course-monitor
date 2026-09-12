// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Buffer } from 'buffer';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { registerSW } from 'virtual:pwa-register';

import App from './App';
import { DataProvider } from './DataContext';
import { AuthProvider } from './hooks/useAuth';
import { offerWebUpdate } from './hooks/useAppUpdate';
import { isOnline } from './firebase';
import './index.css';

window.Buffer = Buffer;

const IS_NATIVE = Capacitor.isNativePlatform();
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.2';
window.APP_VERSION = APP_VERSION;

// -------------------------------------------------------------------------
// VERSION LOG — the old "cache buster" is gone.
// It deleted every cache, unregistered every service worker and reloaded the
// page on EVERY release. On web it fought the service worker it had just
// installed; on native it reloaded at the exact moment Capgo was verifying the
// new bundle, which triggered rollbacks. The service worker (web) and Capgo
// (native) already handle versioning, so we only record the version now.
// -------------------------------------------------------------------------
const previousVersion = localStorage.getItem('app_version');
if (previousVersion !== APP_VERSION) {
  console.log(`ℹ️ App version ${previousVersion || 'unknown'} → ${APP_VERSION}`);
  localStorage.setItem('app_version', APP_VERSION);
}

// =========================================================================
// PLATFORM SETUP
// =========================================================================
if (IS_NATIVE) {
  // A service worker must NOT run inside the native app: it keeps serving the
  // index.html and JS it saved from the OLD bundle after Capgo installs a new
  // one, which looks like "the app went back to the previous version".
  // Remove anything left by earlier builds.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(async (regs) => {
        if (!regs.length) return;
        console.log(`🧹 Removing ${regs.length} service worker(s) from the native WebView`);
        await Promise.allSettled(regs.map((r) => r.unregister()));
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.allSettled(names.map((n) => caches.delete(n)));
        }
        // No reload here on purpose: the running code is already the new bundle.
      })
      .catch((e) => console.warn('Service worker cleanup failed:', e));
  }
} else {
  // Web only. vite.config MUST use VitePWA({ registerType: 'prompt' }) —
  // with 'autoUpdate' the plugin reloads by itself and the popup never shows.
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('⬇️ New web version downloaded.');
      offerWebUpdate(updateSW); // shows the same "Restart and install / Later" popup
    },
    onRegisteredSW(_swUrl, registration) {
      // Users who keep the PWA open for days still get updates.
      if (registration) {
        setInterval(() => {
          if (isOnline()) registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(e) {
      console.error('Service worker registration failed:', e);
    },
  });

  // Ask the browser not to delete IndexedDB when storage is low. The login
  // session AND the Firestore offline cache both live there, so losing it
  // signs the user out and wipes the saved data.
  if (navigator.storage?.persist) {
    navigator.storage
      .persisted()
      .then((already) => already || navigator.storage.persist())
      .then((ok) => console.log(`💾 Persistent storage: ${ok ? 'granted' : 'not granted'}`))
      .catch(() => {});
  }
}

// =========================================================================
// RENDER
// =========================================================================
ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <DataProvider>
      <App />
    </DataProvider>
  </AuthProvider>
);

// Nothing above can reload the page any more, so this call is never cut off.
// If Capgo does not receive it within appReadyTimeout, it rolls the update back.
if (IS_NATIVE) {
  CapacitorUpdater.notifyAppReady()
    .then(() => console.log('✅ Capgo: app booted successfully.'))
    .catch((err) => console.error('❌ Capgo: notifyAppReady failed:', err));
}
