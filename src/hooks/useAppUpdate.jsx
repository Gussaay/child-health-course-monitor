// src/hooks/useAppUpdate.jsx
//
// The ONE place that checks, downloads and applies updates.
// main.jsx only registers the web service worker and hands the result here.
//
// Behaviour:
//   - Never blocks or delays start-up.
//   - Never waits for the network: it only runs when the internet is CONFIRMED
//     working (see firebase.js), so "Wi-Fi with no internet" or "no data
//     balance" is not mistaken for online.
//   - Downloads silently, queues the bundle with next(), then shows a popup:
//     "Restart and install" or "Later". "Later" is safe — the bundle installs
//     by itself the next time the app is opened.
//
// Public API is unchanged:
//   const { appVersion, isDownloadingAppUpdate, appUpdateProgress,
//           handleManualUpdateCheck, AppUpdateModals } = useAppUpdate();

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { doc, onSnapshot } from 'firebase/firestore';
import { RefreshCw, Download, X, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

import {
  db,
  getConnectivity,
  subscribeConnectivity,
  useConnectivity,
  checkConnectionNow,
  reportRequestFailure,
} from '../firebase';
import { downloadAndOpenFile } from '../utils/fileDownloader';

const IS_NATIVE = Capacitor.isNativePlatform();

// Your self-hosted manifest: { version, url, checksum?, mandatory?, notes? }
const UPDATE_MANIFEST_URL = 'https://imnci-courses-monitor.web.app/latest/update.json';

// true = only download OTA bundles on Wi-Fi (Android can tell; iOS always allows)
const WIFI_ONLY_DOWNLOADS = false;

const STARTUP_DELAY_MS = 2000;
const MANIFEST_TIMEOUT_MS = 12_000;
const MANIFEST_TIMEOUT_SLOW_MS = 25_000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;
const MIN_GAP_BETWEEN_CHECKS_MS = 60_000;
const RESUME_RECHECK_MS = 30 * 60_000;
const SKIPPED_BUILD_KEY = 'skipped_native_build';

// Pages where the user may have unsaved data
const DATA_ENTRY_PATH =
  /(form|submit|observe|test|record|edit|new|update|manager|finalreport|attendance)/i;

// =========================================================================
// UPDATE ENGINE — module level, so it runs once no matter how many
// components call the hook. The old version restarted the whole thing every
// time the prompt changed, adding a new Firestore listener and a new
// appStateChange listener each time.
// =========================================================================
let otaState = {
  currentVersion: import.meta.env.VITE_APP_VERSION || window.APP_VERSION || '1.0.2',
  available: false,   // a bundle is downloaded and ready to install
  source: null,       // 'native' | 'web'
  version: null,
  mandatory: false,
  notes: null,
  dismissed: false,   // user pressed "Later"
  downloading: false,
  progress: 0,
  installing: false,
  lastError: null,
};

const otaListeners = new Set();
const otaStore = {
  subscribe(l) { otaListeners.add(l); return () => otaListeners.delete(l); },
  getSnapshot() { return otaState; },
};

function setOta(patch) {
  otaState = { ...otaState, ...patch };
  otaListeners.forEach((l) => l());
}

let pendingBundleId = null;
let webUpdateFn = null;
let checking = false;
let lastCheckAt = 0;
let engineStarted = false;

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const e = new Error(`${label} timed out`);
        e.code = 'timeout';
        reject(e);
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Returns a reason string when an update must not run now, otherwise null. */
function whyNotNow() {
  const net = getConnectivity();
  if (net.status === 'offline') return 'No network connection.';
  if (net.status === 'no-internet') return 'Connected to a network, but there is no internet.';
  if (net.status === 'checking') return 'Checking the connection. Please try again in a moment.';
  if (net.saveData) return 'Data Saver is on, so updates are not downloaded.';
  if (WIFI_ONLY_DOWNLOADS && net.type === 'cellular') return 'Updates only download on Wi-Fi.';
  return null;
}

async function fetchManifest() {
  const slow = getConnectivity().slow;
  // The old code had no time limit here: on a connection that accepts the
  // request but never answers, the check hung forever.
  const res = await withTimeout(
    fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' }),
    slow ? MANIFEST_TIMEOUT_SLOW_MS : MANIFEST_TIMEOUT_MS,
    'Update check'
  );
  if (!res.ok) throw new Error(`Update server returned ${res.status}`);
  const data = await res.json();
  if (!data?.version || !data?.url) throw new Error('The update file on the server is not valid.');
  return data;
}

async function readCurrentVersion() {
  try {
    const { bundle } = await CapacitorUpdater.current();
    const v = bundle?.version || import.meta.env.VITE_APP_VERSION || 'builtin';
    if (v !== otaState.currentVersion) setOta({ currentVersion: v });
    return v;
  } catch {
    return otaState.currentVersion;
  }
}

/** Frees space: old bundles were never deleted and piled up on the phone. */
async function cleanupOldBundles(keepIds = []) {
  try {
    const { bundles = [] } = await CapacitorUpdater.list();
    const { bundle: current } = await CapacitorUpdater.current();
    const keep = new Set([current?.id, ...keepIds].filter(Boolean));
    for (const b of bundles) {
      if (!keep.has(b.id) && b.status !== 'pending') {
        await CapacitorUpdater.delete({ id: b.id }).catch(() => {});
      }
    }
  } catch { /* not important enough to report */ }
}

async function runOtaCheck(reason, { force = false } = {}) {
  if (!IS_NATIVE) return { status: 'not-native' };
  if (checking) return { status: 'busy' };
  if (otaState.available) return { status: 'ready', version: otaState.version };

  const blocked = whyNotNow();
  if (blocked) {
    console.log(`[OTA] Skipping (${reason}): ${blocked}`);
    return { status: 'blocked', message: blocked };
  }
  if (!force && Date.now() - lastCheckAt < MIN_GAP_BETWEEN_CHECKS_MS) return { status: 'too-soon' };

  checking = true;
  lastCheckAt = Date.now();

  try {
    const currentVersion = await readCurrentVersion();
    const latest = await fetchManifest();

    if (latest.version === currentVersion) {
      setOta({ lastError: null });
      return { status: 'up-to-date', version: currentVersion };
    }

    // Reuse a bundle downloaded earlier (e.g. the app was closed half-way)
    const { bundles = [] } = await CapacitorUpdater.list();
    let bundle = bundles.find(
      (b) => b.version === latest.version && (b.status === 'pending' || b.status === 'success')
    );

    if (!bundle) {
      // The network may have changed since the check above.
      const blockedNow = whyNotNow();
      if (blockedNow) return { status: 'blocked', message: blockedNow };

      console.log(`[OTA] Downloading ${latest.version} in the background (${reason})...`);
      setOta({ downloading: true, progress: 0 });

      bundle = await withTimeout(
        CapacitorUpdater.download({
          url: latest.url,
          version: latest.version,
          checksum: latest.checksum,   // undefined is fine if you don't publish one
          sessionKey: latest.sessionKey,
          manifest: latest.manifest,
        }),
        DOWNLOAD_TIMEOUT_MS,
        'Download'
      );
    }

    // Queue it NOW, so closing the app or pressing "Later" still installs it.
    await CapacitorUpdater.next({ id: bundle.id });
    pendingBundleId = bundle.id;

    console.log(`[OTA] ✅ ${latest.version} downloaded and ready.`);
    setOta({
      available: true,
      source: 'native',
      version: latest.version,
      mandatory: !!latest.mandatory,
      notes: latest.notes || null,
      dismissed: false,
      downloading: false,
      progress: 100,
      lastError: null,
    });

    cleanupOldBundles([bundle.id]);
    return { status: 'ready', version: latest.version };
  } catch (e) {
    const message =
      e?.code === 'timeout'
        ? 'The connection is too slow. The update will be tried again later.'
        : e?.message || 'The update could not be downloaded.';
    console.warn('[OTA] Update failed:', message);
    setOta({ downloading: false, progress: 0, lastError: message });
    reportRequestFailure();
    return { status: 'error', message };
  } finally {
    checking = false;
  }
}

/** Called by main.jsx when the web service worker has a new version ready. */
export function offerWebUpdate(updateFn) {
  webUpdateFn = updateFn;
  setOta({ available: true, source: 'web', version: null, dismissed: false });
}

/** Installing uses files already on the phone, so no internet is needed. */
async function installNow() {
  setOta({ installing: true });
  try {
    if (otaState.source === 'native' && pendingBundleId) {
      await CapacitorUpdater.set({ id: pendingBundleId }); // reloads into the new bundle
    } else if (otaState.source === 'web' && webUpdateFn) {
      await webUpdateFn(true);
    }
  } catch (e) {
    console.error('[Update] Install failed:', e);
    setOta({ installing: false, lastError: e?.message || 'Install failed' });
  }
}

function installLater() {
  if (otaState.mandatory) return;
  setOta({ dismissed: true });
  console.log('[Update] "Later" chosen. It will install the next time the app starts.');
}

/** Starts the background checks. Called once from the hook, after mount. */
function startEngine() {
  if (!IS_NATIVE || engineStarted) return;
  engineStarted = true;

  readCurrentVersion();
  cleanupOldBundles();

  // Progress for large bundles on slow networks
  CapacitorUpdater.addListener('download', ({ percent }) => {
    if (typeof percent === 'number') setOta({ downloading: percent < 100, progress: percent });
  });
  CapacitorUpdater.addListener('updateFailed', (info) => {
    console.error('[OTA] ❌ Bundle rolled back:', JSON.stringify(info));
    setOta({ lastError: 'The new version failed to start, so the previous one was restored.' });
  });
  CapacitorUpdater.addListener('downloadFailed', (info) =>
    console.error('[OTA] ❌ Download failed:', JSON.stringify(info))
  );

  // First check, after the app is already on screen
  setTimeout(() => runOtaCheck('startup'), STARTUP_DELAY_MS);

  // Internet CONFIRMED back — not just Wi-Fi reconnecting
  subscribeConnectivity((next, prev) => {
    if (next.status === 'online' && prev.status !== 'online') runOtaCheck('internet-back');
  });

  // App brought back to the foreground
  CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive && Date.now() - lastCheckAt > RESUME_RECHECK_MS) runOtaCheck('resume');
  });

  // NOTE: the old code called set() when the app was MINIMISED. That reloads
  // the WebView in the background; if Android then kills the app before
  // notifyAppReady() runs, Capgo treats the bundle as broken and restores the
  // old one. That is why users saw the app go back to the previous version.
  // next() above already queued the bundle, so it installs safely on next launch.
}

// =========================================================================
// HOOK
// =========================================================================
export function useAppUpdate() {
  const ota = useSyncExternalStore(otaStore.subscribe, otaStore.getSnapshot);
  const net = useConnectivity();

  // --- NATIVE APK UPDATE (a new build; OTA cannot deliver native code) ---
  const [nativeUpdatePrompt, setNativeUpdatePrompt] = useState(null);
  const [apkDownloading, setApkDownloading] = useState(false);
  const [apkProgress, setApkProgress] = useState(0);
  const [manualModal, setManualModal] = useState({ isOpen: false, status: 'idle', message: '' });

  const promptRef = useRef(null);
  promptRef.current = nativeUpdatePrompt;
  const laterButton = useRef(null);

  useEffect(() => { startEngine(); }, []);

  const evaluateConfig = useCallback(async (serverConfig) => {
    if (!serverConfig) return;
    try {
      const appInfo = await CapacitorApp.getInfo();
      const currentBuild = parseInt(appInfo.build, 10) || 1;
      const serverBuild = parseInt(serverConfig.latestNativeBuild, 10);
      if (!Number.isFinite(serverBuild) || serverBuild <= currentBuild) {
        setNativeUpdatePrompt(null);
        return;
      }
      // "Not now" now survives a restart (it was a ref, lost on every reload).
      const skipped = parseInt(localStorage.getItem(SKIPPED_BUILD_KEY), 10);
      if (!serverConfig.mandatory && skipped === serverBuild) {
        setNativeUpdatePrompt(null);
        return;
      }
      setNativeUpdatePrompt({ ...serverConfig, serverBuild });
    } catch (e) {
      console.warn('[Native update] Could not read app info:', e);
    }
  }, []);

  useEffect(() => {
    if (!IS_NATIVE) return;
    let unsubscribeConfig = null;

    // onSnapshot works offline too: it serves the saved copy first, then
    // updates when the server is reachable. The old code returned early when
    // the device was offline at start-up, so the listener was never attached
    // again for the rest of that session.
    unsubscribeConfig = onSnapshot(
      doc(db, 'meta', 'update_config'),
      (snap) => { if (snap.exists()) evaluateConfig(snap.data()); },
      (err) => console.warn('[Native update] Config listener error:', err?.code)
    );

    return () => unsubscribeConfig?.();
  }, [evaluateConfig]);

  // --- MANUAL "Check for updates" BUTTON ---
  const handleManualUpdateCheck = useCallback(async () => {
    if (!IS_NATIVE) {
      setManualModal({
        isOpen: true,
        status: 'info',
        message: 'The web version updates itself when you refresh the page.',
      });
      setTimeout(() => setManualModal({ isOpen: false, status: 'idle', message: '' }), 3000);
      return;
    }

    const current = getConnectivity();
    if (current.status === 'offline') {
      setManualModal({
        isOpen: true,
        status: 'error',
        message: 'No network connection. Turn off airplane mode, or turn on mobile data or Wi-Fi.',
      });
      return;
    }
    if (current.status === 'no-internet') {
      setManualModal({
        isOpen: true,
        status: 'error',
        message:
          current.type === 'wifi'
            ? 'Connected to Wi-Fi, but it has no internet.'
            : 'There is no internet. Check your signal or data balance.',
      });
      return;
    }

    setManualModal({ isOpen: true, status: 'checking', message: 'Checking for updates...' });

    // A new APK always wins: OTA cannot deliver changed native code.
    if (promptRef.current) {
      setManualModal({ isOpen: false, status: 'idle', message: '' });
      return;
    }

    const result = await runOtaCheck('manual', { force: true });

    if (result.status === 'ready') {
      setManualModal({ isOpen: false, status: 'idle', message: '' }); // popup takes over
    } else if (result.status === 'up-to-date') {
      setManualModal({
        isOpen: true,
        status: 'success',
        message: `The app is up to date (version ${result.version}).`,
      });
      setTimeout(() => setManualModal({ isOpen: false, status: 'idle', message: '' }), 3000);
    } else if (result.status === 'blocked' || result.status === 'error') {
      setManualModal({ isOpen: true, status: 'error', message: result.message });
    } else {
      setManualModal({ isOpen: true, status: 'info', message: 'A check is already running.' });
      setTimeout(() => setManualModal({ isOpen: false, status: 'idle', message: '' }), 2500);
    }
  }, []);

  const downloadApk = useCallback((config) => {
    if (!config?.apkUrl) return;
    downloadAndOpenFile(config.apkUrl, `NCHP-${config.latestNativeBuild || 'latest'}.apk`, {
      isSystemFile: true,
      onStart: () => { setApkDownloading(true); setApkProgress(0); },
      onProgress: (p) => setApkProgress(Math.round(p)),
      onFinally: () => setApkDownloading(false),
      onError: (e) =>
        setManualModal({
          isOpen: true,
          status: 'error',
          message: `The download failed: ${e?.message || 'unknown error'}`,
        }),
      onOpenError: () =>
        setManualModal({
          isOpen: true,
          status: 'info',
          message:
            'The file was downloaded. Open it from your Downloads and allow installing from this app if asked.',
        }),
    });
  }, []);

  const skipNativeBuild = useCallback(() => {
    const build = promptRef.current?.serverBuild;
    if (build) localStorage.setItem(SKIPPED_BUILD_KEY, String(build));
    setNativeUpdatePrompt(null);
  }, []);

  // --- ALL MODALS + THE CONNECTION BANNER ---
  const AppUpdateModals = useCallback(() => {
    const closeManual = () => setManualModal({ isOpen: false, status: 'idle', message: '' });
    const otaVisible = ota.available && !ota.dismissed && !nativeUpdatePrompt;
    const onDataEntryPage = DATA_ENTRY_PATH.test(window.location.pathname);

    const banner =
      net.status === 'offline'
        ? {
            tone: 'bg-gray-800 text-white',
            text: 'No network. Turn off airplane mode or turn on mobile data / Wi-Fi. You are seeing saved data; your changes will upload later.',
          }
        : net.status === 'no-internet'
        ? {
            tone: 'bg-amber-100 text-amber-900',
            text:
              (net.type === 'wifi'
                ? 'Connected to Wi-Fi, but it has no internet.'
                : net.type === 'cellular'
                ? 'Mobile data is on, but there is no internet. Check signal or data balance.'
                : 'Connected to a network, but there is no internet.') +
              ' Showing saved data; changes will upload later.',
          }
        : null; // A slow connection still works, so nothing is shown for it.

    return (
      <>
        {banner && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed inset-x-0 top-0 z-40 flex items-center gap-3 px-4 py-2 text-sm ${banner.tone}`}
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
          >
            <span className="flex-1">{banner.text}</span>
            {net.status !== 'online' && (
              <button
                type="button"
                onClick={() => checkConnectionNow('user-retry')}
                disabled={net.checking}
                className="shrink-0 rounded-md border border-current px-3 py-1 font-medium disabled:opacity-50"
              >
                {net.checking ? 'Checking…' : 'Retry'}
              </button>
            )}
          </div>
        )}

        {nativeUpdatePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-start gap-3">
                <Download className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {nativeUpdatePrompt.mandatory ? 'Update required' : 'New app version'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {nativeUpdatePrompt.message ||
                      'A new version of the app is available. Download and install it to keep receiving updates.'}
                  </p>
                </div>
              </div>

              {apkDownloading && (
                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full bg-blue-600 transition-all" style={{ width: `${apkProgress}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Downloading… {apkProgress}%</p>
                </div>
              )}

              <div className="mt-5 flex gap-3">
                {!nativeUpdatePrompt.mandatory && (
                  <button
                    type="button"
                    onClick={skipNativeBuild}
                    disabled={apkDownloading}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Not now
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => downloadApk(nativeUpdatePrompt)}
                  disabled={apkDownloading}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {apkDownloading ? 'Downloading…' : 'Download and install'}
                </button>
              </div>
            </div>
          </div>
        )}

        {otaVisible && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ota-title"
          >
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
              <h2 id="ota-title" className="text-lg font-semibold text-gray-900">
                Update ready{ota.version ? ` (${ota.version})` : ''}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {ota.mandatory
                  ? 'A required update has been downloaded. The app must restart to install it.'
                  : 'A new version has been downloaded. Restart now to install it, or choose Later and it will install by itself the next time you open the app.'}
              </p>
              {ota.notes && <p className="mt-2 text-sm text-gray-500">{ota.notes}</p>}

              {onDataEntryPage && (
                <p className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-800">
                  You are on a data entry page. Save your work before restarting, or choose Later.
                </p>
              )}

              <div className="mt-5 flex gap-3">
                {!ota.mandatory && (
                  <button
                    ref={laterButton}
                    type="button"
                    onClick={installLater}
                    disabled={ota.installing}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Later
                  </button>
                )}
                <button
                  type="button"
                  onClick={installNow}
                  disabled={ota.installing}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {ota.installing ? 'Installing…' : 'Restart and install'}
                </button>
              </div>
            </div>
          </div>
        )}

        {manualModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-start gap-3">
                {manualModal.status === 'checking' && (
                  <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-blue-600" />
                )}
                {manualModal.status === 'success' && (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                )}
                {manualModal.status === 'error' && (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                )}
                {manualModal.status === 'info' && (
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
                )}
                <p className="flex-1 text-sm text-gray-700">{manualModal.message}</p>
                {manualModal.status !== 'checking' && (
                  <button type="button" onClick={closeManual} aria-label="Close">
                    <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-gray-400">Current version: {ota.currentVersion}</p>
            </div>
          </div>
        )}
      </>
    );
  }, [ota, net, nativeUpdatePrompt, apkDownloading, apkProgress, manualModal, downloadApk, skipNativeBuild]);

  return {
    appVersion: ota.currentVersion,
    isDownloadingAppUpdate: ota.downloading || apkDownloading,
    appUpdateProgress: apkDownloading ? apkProgress : ota.progress,
    handleManualUpdateCheck,
    AppUpdateModals,
    otaUpdateReady: ota.available && !ota.dismissed,
    nativeUpdateRequired: !!nativeUpdatePrompt?.mandatory,
  };
}
