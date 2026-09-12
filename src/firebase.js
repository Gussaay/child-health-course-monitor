// firebase.js
// Firebase setup + real connection detection + cache-first reads, all in one
// file so nothing new has to be imported anywhere else.

import { useSyncExternalStore } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableNetwork,
  disableNetwork,
  getDocFromCache,
  getDocFromServer,
  getDocsFromCache,
  getDocsFromServer,
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: 'AIzaSyDRZoNR9eiAnE9RyqPZ-eXYbhkWOuJmoyI',
  authDomain: 'imnci-courses-monitor.firebaseapp.com',
  projectId: 'imnci-courses-monitor',
  storageBucket: 'gs://imnci-courses-monitor.firebasestorage.app',
  messagingSenderId: '928082473485',
  appId: '1:928082473485:web:cbbde89d57c657f52a9b44',
  measurementId: 'G-MX7PF4VTLC',
};

// Exported under both names: auth.js imported `firebaseApp`, which did not exist.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const app = firebaseApp;

// =========================================================================
// AUTH
// Inside the native WebView, getAuth() also loads the web popup/redirect
// machinery (a hidden iframe to authDomain), which hangs or fails in Capacitor,
// especially on iOS. Native sign-in goes through SocialLogin, so it only needs
// a persistent store. This is one cause of users being signed out.
// =========================================================================
function createAuth() {
  if (!Capacitor.isNativePlatform()) return getAuth(firebaseApp);
  try {
    return initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    return getAuth(firebaseApp); // already initialised (hot reload)
  }
}
export const auth = createAuth();

// DIAGNOSTIC: prints a stack trace every time ANY code calls signOut(auth).
// If users are logged out and this never prints, the stored session was
// cleared by the browser/OS, not by your code. Remove once the bug is found.
const realSignOut = auth.signOut.bind(auth);
auth.signOut = async (...args) => {
  console.warn('[Auth] signOut() called from:\n', new Error().stack);
  return realSignOut(...args);
};

// =========================================================================
// FIRESTORE
// Default cache is ~40 MB; above that Firestore quietly deletes documents, so
// large course data stops being available offline. 100 MB gives headroom.
// If you ever see "Falling back to memory cache" in the console, nothing is
// being saved between app launches at all.
// =========================================================================
function createDb() {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: 100 * 1024 * 1024,
      }),
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}
export const db = createDb();

export const storage = getStorage(firebaseApp);

// Analytics throws in some WebViews. It must never crash start-up, because a
// crash before notifyAppReady() makes Capgo roll the update back.
export const analytics = (() => {
  try {
    return getAnalytics(firebaseApp);
  } catch (e) {
    console.warn('Analytics disabled in this environment:', e?.message);
    return null;
  }
})();

// =========================================================================
// REAL CONNECTION DETECTION
//
// navigator.onLine (and Capacitor's Network plugin) only report that a network
// is CONNECTED. They still say "online" when:
//   - Wi-Fi is connected but the router has no internet
//   - mobile data is on but there is no signal, balance or data bundle
//   - public Wi-Fi is waiting for a login page
//   - DNS fails, a firewall blocks the servers
//   - the phone's date and time are wrong (secure connections are refused)
// So "online" below is only reported after actually reaching the servers.
//
// Statuses: 'checking' | 'online' | 'no-internet' | 'offline'
// ('offline' covers airplane mode, data/Wi-Fi off and no signal. Apps cannot
// tell those apart, and the app behaves the same way in all of them.)
// =========================================================================
const PROBE_URLS = [
  'https://firestore.googleapis.com/',    // the database itself
  'https://www.gstatic.com/generate_204', // standard connectivity check
];
const PROBE_TIMEOUT_MS = 8_000;
const PROBE_TIMEOUT_LONG_MS = 20_000;
const SLOW_LATENCY_MS = 2_500;
const RETRY_AFTER_BLIP_MS = 2_000;
const ONLINE_RECHECK_MS = 3 * 60_000;
const BACKOFF_MS = [5_000, 10_000, 20_000, 40_000, 60_000];

function connectionApi() {
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}
function readConnectionInfo() {
  const c = connectionApi();
  return {
    saveData: !!c?.saveData,       // Data Saver is on
    type: c?.type || 'unknown',    // 'wifi' | 'cellular' | 'none' | 'unknown'
    radioIs2G: c?.effectiveType === 'slow-2g' || c?.effectiveType === '2g',
  };
}

const firstInfo = readConnectionInfo();
let netState = {
  status: navigator.onLine === false || firstInfo.type === 'none' ? 'offline' : 'checking',
  slow: false,
  saveData: firstInfo.saveData,
  type: firstInfo.type,
  latencyMs: null,
  checking: false,
};

const netListeners = new Set();

function setNetState(patch) {
  const prev = netState;
  netState = { ...netState, ...patch };
  if (prev.status !== netState.status || prev.slow !== netState.slow) {
    const fmt = (s) => `${s.status}${s.slow ? ' (slow)' : ''}`;
    console.log(`[Net] ${fmt(prev)} → ${fmt(netState)}`);
  }
  netListeners.forEach((l) => l(netState, prev));
}

export const getConnectivity = () => netState;
export const isOnline = () => netState.status === 'online';

export function subscribeConnectivity(listener) {
  netListeners.add(listener);
  return () => netListeners.delete(listener);
}

/** React hook: const net = useConnectivity(); */
export function useConnectivity() {
  return useSyncExternalStore(subscribeConnectivity, getConnectivity);
}

function probe(url, timeoutMs) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const target = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller?.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
    // no-cors: any real answer counts; network/TLS errors reject. A captive
    // portal cannot fake a successful HTTPS answer from these hosts.
    fetch(target, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller?.signal,
    }).then(
      () => { clearTimeout(timer); resolve(); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// Promise.any is missing in some older Android WebViews
function firstSuccess(promises) {
  return new Promise((resolve, reject) => {
    let failed = 0;
    promises.forEach((p) =>
      p.then(resolve, () => {
        failed += 1;
        if (failed === promises.length) reject(new Error('all probes failed'));
      })
    );
  });
}

let probeInFlight = null;
let netFailures = 0;
let backoffStep = 0;
let netTimer = null;

async function runNetCheck(reason) {
  const info = readConnectionInfo();
  const base = { saveData: info.saveData, type: info.type };

  if (navigator.onLine === false || info.type === 'none') {
    netFailures = 0;
    setNetState({ ...base, status: 'offline', slow: false, latencyMs: null, checking: false });
    return;
  }

  setNetState({ checking: true });
  const timeout = netFailures >= 2 ? PROBE_TIMEOUT_LONG_MS : PROBE_TIMEOUT_MS;
  const started = Date.now();

  try {
    await firstSuccess(PROBE_URLS.map((u) => probe(u, timeout)));
    const latencyMs = Date.now() - started;
    netFailures = 0;
    backoffStep = 0;
    setNetState({
      ...base,
      status: 'online',
      slow: info.radioIs2G || latencyMs > SLOW_LATENCY_MS,
      latencyMs,
      checking: false,
    });
  } catch {
    netFailures += 1;
    if (netState.status === 'online' && netFailures === 1) {
      // One failure on a working connection is usually a blip (tunnel, lift,
      // tower hand-over). Retry in 2 s before telling the app.
      setNetState({ ...base, checking: false });
    } else {
      setNetState({
        ...base,
        status: navigator.onLine === false ? 'offline' : 'no-internet',
        slow: false,
        latencyMs: null,
        checking: false,
      });
    }
    console.debug(`[Net] probe failed (${reason}), failures=${netFailures}`);
  }
}

function scheduleNextNetCheck() {
  clearTimeout(netTimer);
  if (document.visibilityState === 'hidden') return; // saves battery and data
  let delay;
  if (netState.status === 'online') {
    delay = netFailures > 0 ? RETRY_AFTER_BLIP_MS : ONLINE_RECHECK_MS;
  } else {
    // The internet can come back with no event at all (e.g. the router regains
    // service), so keep checking: 5 s, 10 s, 20 s, 40 s, then every minute.
    delay = BACKOFF_MS[Math.min(backoffStep, BACKOFF_MS.length - 1)];
    backoffStep += 1;
  }
  netTimer = setTimeout(() => checkConnectionNow('scheduled'), delay);
}

/** Runs a check now (never two at once). Never blocks the app. */
export function checkConnectionNow(reason = 'manual') {
  if (probeInFlight) return probeInFlight;
  probeInFlight = runNetCheck(reason)
    .finally(() => {
      probeInFlight = null;
      scheduleNextNetCheck();
    })
    .then(() => netState);
  return probeInFlight;
}

let lastFailureReport = 0;
/** Call when a server request fails unexpectedly; triggers a quick re-check. */
export function reportRequestFailure() {
  const now = Date.now();
  if (now - lastFailureReport < 5_000) return;
  lastFailureReport = now;
  checkConnectionNow('request-failed');
}

// --- start monitoring (nothing here waits, so start-up is never delayed) ---
window.addEventListener('offline', () => {
  netFailures = 0;
  setNetState({ status: 'offline', slow: false, latencyMs: null });
  scheduleNextNetCheck();
});
window.addEventListener('online', () => {
  backoffStep = 0;
  checkConnectionNow('online-event'); // a network is back; the probe confirms internet
});
connectionApi()?.addEventListener?.('change', () => {
  backoffStep = 0;
  checkConnectionNow('network-changed'); // Wi-Fi ↔ mobile data, signal change
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    backoffStep = 0;
    checkConnectionNow('app-resumed');
  } else {
    clearTimeout(netTimer);
  }
});
checkConnectionNow('startup');

// --- Firestore follows the real connection state ---
// Without this, on "Wi-Fi with no internet" every read waits ~10 s for the
// server before falling back to the cache. With it, reads come from the cache
// instantly and writes are queued on the device until the internet returns.
(() => {
  let networkOn = true;
  let chain = Promise.resolve();
  const sync = () => {
    const shouldBeOn = netState.status === 'online' || netState.status === 'checking';
    if (shouldBeOn === networkOn) return;
    networkOn = shouldBeOn;
    chain = chain
      .then(() => (shouldBeOn ? enableNetwork(db) : disableNetwork(db)))
      .then(() =>
        console.log(`[Net] Firestore ${shouldBeOn ? 'ON: syncing' : 'OFF: cache only, writes queued'}`)
      )
      .catch((e) => console.warn('[Net] Firestore network toggle failed:', e));
  };
  subscribeConnectivity(sync);
})();

// =========================================================================
// CACHE-FIRST READS
//
// With offline persistence on, getDoc()/getDocs() STILL go to the server
// whenever the device is online — the cache is only used when offline. That is
// why the app re-downloads data it already has. These helpers read the cache
// first and only contact the server when the saved copy is older than maxAgeMs.
//
//   const snap = await getDocsCacheFirst(query(collection(db,'courses')), 'courses');
//   const snap = await getDocsCacheFirst(q, 'courses', { forceServer: true }); // pull-to-refresh
//   const snap = await getDocsCacheFirst(q, 'courses', { onUpdate: (fresh) => setCourses(fresh) });
//   const snap = await getDocCacheFirst(doc(db, 'users', uid));
// =========================================================================
const STAMP_PREFIX = 'fs_last_server_fetch:';
const DEFAULT_MAX_AGE = 15 * 60 * 1000;
const SERVER_TIMEOUT_MS = 12_000;
const SERVER_TIMEOUT_SLOW_MS = 25_000;

const stampOf = (key) => Number(localStorage.getItem(STAMP_PREFIX + key) || 0);
const isFresh = (key, maxAgeMs) => {
  const t = stampOf(key);
  return t > 0 && Date.now() - t < maxAgeMs;
};
const markFetched = (key) => localStorage.setItem(STAMP_PREFIX + key, String(Date.now()));

// 'checking' means "maybe": we may try the server, but never wait on it when a
// cached copy exists.
const serverAllowed = (net) => net.status === 'online' || net.status === 'checking';
const shouldNotWait = (net) => net.slow || net.status === 'checking';

function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      t = setTimeout(() => {
        const err = new Error(`${label} timed out after ${ms} ms`);
        err.code = 'timeout';
        reject(err);
      }, ms);
    }),
  ]).finally(() => clearTimeout(t));
}

function notAvailableOffline(what) {
  const err = new Error(`${what} is not saved on this device and there is no internet.`);
  err.code = 'offline-not-cached';
  return err;
}

const refreshing = new Set();

export async function getDocsCacheFirst(
  q,
  key,
  { maxAgeMs = DEFAULT_MAX_AGE, forceServer = false, onUpdate } = {}
) {
  const net = netState;

  let cached = null;
  try {
    cached = await getDocsFromCache(q);
  } catch { /* nothing cached */ }
  // An empty cached result only counts if this query was fetched before.
  const usable = !!cached && (!cached.empty || stampOf(key) > 0);

  // 1. No internet: give whatever the device has, right now.
  if (!serverAllowed(net)) {
    if (cached) return cached;
    throw notAvailableOffline(`"${key}"`);
  }

  // 2. Fresh enough: no server call at all.
  if (!forceServer && usable && isFresh(key, maxAgeMs)) return cached;

  const fromServer = () =>
    withTimeout(
      getDocsFromServer(q).then((snap) => { markFetched(key); return snap; }),
      net.slow ? SERVER_TIMEOUT_SLOW_MS : SERVER_TIMEOUT_MS,
      `Server read "${key}"`
    );

  // 3. Slow or unconfirmed network: show saved data now, refresh quietly.
  if (!forceServer && usable && (shouldNotWait(net) || onUpdate)) {
    if (!refreshing.has(key)) {
      refreshing.add(key);
      fromServer()
        .then((fresh) => onUpdate?.(fresh))
        .catch(() => reportRequestFailure())
        .finally(() => refreshing.delete(key));
    }
    return cached;
  }

  // 4. Go to the server, fall back to the cache.
  try {
    return await fromServer();
  } catch (err) {
    console.warn(`[cache-first] "${key}": ${err.code || err.message}. Using saved data.`);
    reportRequestFailure();
    if (cached) return cached;
    throw err;
  }
}

// IMPORTANT: an error here means "could not read", NOT "does not exist".
// Use snap.exists() for that. Never sign a user out because this threw.
export async function getDocCacheFirst(
  ref,
  { maxAgeMs = DEFAULT_MAX_AGE, forceServer = false, onUpdate } = {}
) {
  const key = ref.path;
  const net = netState;

  let cached = null;
  try {
    cached = await getDocFromCache(ref);
  } catch { /* not cached */ }

  if (!serverAllowed(net)) {
    if (cached) return cached;
    throw notAvailableOffline(`Document ${key}`);
  }

  if (!forceServer && cached && isFresh(key, maxAgeMs)) return cached;

  const fromServer = () =>
    withTimeout(
      getDocFromServer(ref).then((snap) => { markFetched(key); return snap; }),
      net.slow ? SERVER_TIMEOUT_SLOW_MS : SERVER_TIMEOUT_MS,
      `Server read ${key}`
    );

  if (!forceServer && cached && (shouldNotWait(net) || onUpdate)) {
    if (!refreshing.has(key)) {
      refreshing.add(key);
      fromServer()
        .then((fresh) => onUpdate?.(fresh))
        .catch(() => reportRequestFailure())
        .finally(() => refreshing.delete(key));
    }
    return cached;
  }

  try {
    return await fromServer();
  } catch (err) {
    reportRequestFailure();
    if (cached) return cached;
    throw err;
  }
}

// Writes that never freeze the screen.
// Firestore saves a write on the device instantly, but its promise only
// finishes when the SERVER confirms. Offline, `await setDoc(...)` waits forever
// and the form looks stuck.
//
//   const ref = doc(collection(db, 'observations'));
//   const { synced } = await saveOfflineSafe(setDoc(ref, data), { label: 'observation' });
//   showToast(synced ? 'Saved' : 'Saved on this device. It will upload when online.');
export async function saveOfflineSafe(writePromise, { label = 'write', timeoutMs = 10_000 } = {}) {
  writePromise.catch((e) => console.error(`[sync] ${label} rejected by server:`, e));
  if (!isOnline()) return { synced: false };
  try {
    await withTimeout(writePromise, timeoutMs, label);
    return { synced: true };
  } catch (err) {
    // Real rejections (permission-denied, invalid data) must reach the UI.
    if (err?.code && err.code !== 'timeout' && err.code !== 'unavailable') throw err;
    reportRequestFailure();
    return { synced: false };
  }
}

/** Call on logout so the next user does not inherit "fresh" timestamps. */
export function clearFetchStamps() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(STAMP_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}
