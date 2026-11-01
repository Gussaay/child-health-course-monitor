// src/utils/staleBuild.js
//
// RECOVERY FROM A STALE BUILD
// Each release renames the code files. A page still running the previous
// release asks for the old names, and the screen it was opening fails to
// load. When that happens, drop the saved scripts and start again on the
// current release. Once per two minutes at most, so a page that is genuinely
// broken, or offline, does not reload forever.
//
// Used by main.jsx (Vite's preload error, unhandled rejections) and by the
// error boundary, which is where a lazily loaded screen's failure lands.

const CHUNK_CACHES = ['app-chunks', 'app-chunks-v2'];
const RECOVERY_KEY = 'stale_build_recovery_at';
// Set once this page has started reloading. Vite's preload error (main.jsx)
// fires just before the error boundary sees the same failure, and both call
// in here: the second caller must hear "reloading", not "skipped".
let reloading = false;

export const isChunkLoadError = (reason) => {
  const text = String(reason?.message || reason || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Expected a JavaScript-or-Wasm module script|Unable to preload CSS|ChunkLoadError|Loading chunk \S+ failed/i.test(text);
};

/**
 * Reloads onto the current release. Returns true when a reload is under way,
 * false when it was skipped (offline, or already tried in the last two
 * minutes) so the caller can show the error instead.
 */
export function recoverFromStaleBuild(reason) {
  if (reloading) return true;
  try {
    const last = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
    if (Date.now() - last < 2 * 60 * 1000) return false;
    if (navigator.onLine === false) return false;
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
  } catch { /* storage unavailable: still try once */ }
  reloading = true;
  console.warn('♻️ A script from an older release could not be loaded; reloading on the current one.', reason);
  (async () => {
    try {
      if ('caches' in window) await Promise.allSettled(CHUNK_CACHES.map((name) => caches.delete(name)));
      const reg = await navigator.serviceWorker?.getRegistration?.();
      await reg?.update?.().catch(() => {});
    } catch { /* reload regardless */ }
    window.location.reload();
  })();
  return true;
}
