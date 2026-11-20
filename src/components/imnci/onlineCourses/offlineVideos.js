// Course videos saved on the device, so a learner downloads each video once
// and then watches it without the internet.
//
// The videos themselves stay on YouTube for streaming. A copy of each (the
// same 360p/480p MP4 that went to YouTube) is kept in Firebase Storage under
// course-videos/, listed in course-videos/index.json as
// { "videos": { "<YouTube id>": { "url": "<download URL>", "bytes": n, "seconds": n } } }.
// The workflow scripts/course-videos writes both; the index has a fixed
// download token (below) so the app can read it without signing in. Only a learner who taps "Download for offline"
// fetches a file; it goes into the browser's Cache Storage (also in the
// Android app's WebView) and plays from there from then on.
const BUCKET = 'imnci-courses-monitor.firebasestorage.app';
const objectUrl = (path) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
const INDEX_URL = `${objectUrl('course-videos/index.json')}&token=7452ee19-bd42-4e90-8bf7-8dddd7d30127`;
const CACHE = 'oc-videos-v1';
const INDEX_KEY = 'oc-video-index';
const INDEX_TTL = 12 * 60 * 60 * 1000;

const hasCache = () => typeof window !== 'undefined' && 'caches' in window;
const cacheKey = (id) => `/offline-video/${id}.mp4`;

let indexPromise = null;
/** The list of videos that can be downloaded; {} when there is none or offline. */
export function getVideoIndex() {
    if (indexPromise) return indexPromise;
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem(INDEX_KEY) || 'null'); } catch { saved = null; }
    if (saved && Date.now() - saved.at < INDEX_TTL) {
        indexPromise = Promise.resolve(saved.index || {});
        return indexPromise;
    }
    indexPromise = fetch(INDEX_URL, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : {}))
        .then((index) => {
            const clean = index && typeof index === 'object' ? (index.videos || index) : {};
            try { window.localStorage.setItem(INDEX_KEY, JSON.stringify({ at: Date.now(), index: clean })); } catch { /* private mode */ }
            return clean;
        })
        .catch(() => (saved?.index || {}));
    return indexPromise;
}

export async function isVideoSaved(id) {
    if (!hasCache() || !id) return false;
    try {
        const c = await caches.open(CACHE);
        return !!(await c.match(cacheKey(id)));
    } catch { return false; }
}

/** A blob: address for the saved copy, or null. The caller revokes it. */
export async function savedVideoUrl(id) {
    if (!hasCache() || !id) return null;
    try {
        const c = await caches.open(CACHE);
        const res = await c.match(cacheKey(id));
        if (!res) return null;
        return URL.createObjectURL(await res.blob());
    } catch { return null; }
}

const listeners = new Set();
const notify = (id) => listeners.forEach((fn) => { try { fn(id); } catch { /* ignore */ } });
/** Called with the video id whenever a video is saved or removed. */
export function onSavedVideosChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const running = new Map();
/**
 * Downloads one video into the device. `onProgress(fraction)` while it runs.
 * Returns a promise; a second call for the same video joins the first.
 */
export function saveVideo(id, entry, onProgress) {
    if (!hasCache()) return Promise.reject(new Error('This browser cannot keep videos.'));
    if (running.has(id)) {
        const job = running.get(id);
        if (onProgress) job.watchers.add(onProgress);
        return job.promise;
    }
    const watchers = new Set(onProgress ? [onProgress] : []);
    const promise = (async () => {
        if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
        const res = await fetch(entry.url);
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const total = Number(res.headers.get('content-length')) || Number(entry.bytes) || 0;
        let blob;
        if (res.body && total) {
            const reader = res.body.getReader();
            const parts = [];
            let got = 0;
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                parts.push(value);
                got += value.length;
                watchers.forEach((fn) => fn(Math.min(1, got / total)));
            }
            blob = new Blob(parts, { type: 'video/mp4' });
        } else blob = await res.blob();
        const c = await caches.open(CACHE);
        await c.put(cacheKey(id), new Response(blob, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(blob.size) } }));
        notify(id);
    })().finally(() => running.delete(id));
    running.set(id, { promise, watchers });
    return promise;
}

export async function removeVideo(id) {
    if (!hasCache()) return;
    try { const c = await caches.open(CACHE); await c.delete(cacheKey(id)); } catch { /* ignore */ }
    notify(id);
}

export const formatMB = (bytes) => `${Math.max(0.1, (Number(bytes) || 0) / 1048576).toFixed(Number(bytes) > 10 * 1048576 ? 0 : 1)} MB`;
