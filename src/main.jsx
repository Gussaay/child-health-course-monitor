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
import { DATA_ENTRY_PATH } from './hooks/useAppUpdate';
import { applyWebUpdateQuietly } from './utils/quietWebUpdate';
import { startUpdateHold } from './utils/updateHold';
import { isOnline } from './firebase';
import { IS_EMONC_SITE, EMONC_SITE_TITLE } from './siteMode';
import { isChunkLoadError, recoverFromStaleBuild } from './utils/staleBuild';
import { installErrorCapture } from './utils/errorCapture';
import './index.css';

window.Buffer = Buffer;

if (IS_EMONC_SITE) document.title = EMONC_SITE_TITLE;

const IS_NATIVE = Capacitor.isNativePlatform();
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.2';
window.APP_VERSION = APP_VERSION;
// The version people see (package.json releaseVersion), stamped on problem reports.
window.__APP_VERSION__ = import.meta.env.VITE_RELEASE_VERSION || APP_VERSION;

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
// RECOVERY FROM A STALE BUILD (utils/staleBuild.js)
//
// The preload error is NOT cancelled with preventDefault() any more. Cancelling
// it makes Vite resolve the import with `undefined` instead of failing, so the
// screen then crashed with "can't access property 'CourseReportView', t is
// undefined" (or "reading 'default'") — about 40 of the crash reports in
// Admin → Problems were exactly that. Left alone, the import fails with the
// real loading error, the error boundary sees it, reloads onto the current
// release and shows "Loading the latest version" instead of a crash.
// =========================================================================
window.addEventListener('vite:preloadError', (event) => {
  recoverFromStaleBuild(event.payload);
});
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) recoverFromStaleBuild(event.reason);
});

// Permission refusals and other handled errors go to Admin → Problems.
installErrorCapture();

// The cache before the fix may hold HTML saved under script names; it is no
// longer read, so free the space.
if ('caches' in window) caches.delete('app-chunks').catch(() => {});

// =========================================================================
// PLATFORM SETUP
// =========================================================================
if (IS_NATIVE) {
  // A downloaded update is applied by Capgo the moment the app goes into the
  // background, which reloads the page. Hold it while a form, a test or any
  // popup is open, so switching to another app and back keeps the work on
  // screen (utils/updateHold.js).
  startUpdateHold(() => DATA_ENTRY_PATH.test(window.location.pathname));

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
  // with 'autoUpdate' the plugin reloads by itself.
  //
  // UPDATES ARE SILENT, like an ordinary website. A new release downloads in
  // the background and its service worker takes over (skipWaiting), but the
  // page that is open keeps running until it is next opened — no popup, no
  // reload in the middle of work. utils/quietWebUpdate.js also switches over
  // a minute after the app goes into the background. The files of the release the
  // page is running stay on the server for two weeks (deploy.yml), so screens
  // opened after a release still load.
  //
  // This used to show a "Restart and install" popup, and the PWA plugin's own
  // 'controlling' handler reloaded the page whenever a release found during a
  // session took control — the sudden refresh users saw after each deploy.
  // onNeedReload below replaces that reload.
  const busy = () => DATA_ENTRY_PATH.test(window.location.pathname);
  const hadController = !!navigator.serviceWorker?.controller;
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install, not an update
    console.log('⬇️ New web version installed; it starts the next time the app opens.');
    applyWebUpdateQuietly(() => window.location.reload(), { busy });
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Only when a release is waiting (skipWaiting normally makes this rare).
      console.log('⬇️ New web version downloaded.');
      applyWebUpdateQuietly(() => updateSW(), { busy });
    },
    onNeedReload() {
      // The new release took control. Not reloading here on purpose: the
      // controllerchange listener above schedules a quiet switch instead.
    },
    onRegisteredSW(_swUrl, registration) {
      // Users who keep the PWA open for days still get updates: every 12
      // hours, on top of the check the browser makes at every page load.
      if (registration) {
        setInterval(() => {
          if (isOnline()) registration.update().catch(() => {});
        }, 12 * 60 * 60 * 1000);
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
