// src/components/imnci/onlineCourses/fileCache.js
//
// Course pictures kept on the device, so a module saved for offline shows its
// figures and captured book pages without a connection.
//
// The browser's Cache Storage holds them, filed under a made-up address per
// Storage path. It is used directly rather than through the service worker:
// the Android app runs without one (main.jsx removes it), and Storage download
// links carry a token that changes, so the worker could not match them anyway.
const CACHE = 'online-course-files-v1';
const keyFor = (fullPath) => `https://offline.course-files/${encodeURI(fullPath)}`;

export const fileCacheAvailable = () => typeof caches !== 'undefined';

// Object URLs already made this session, so a picture is read from the cache
// once rather than on every render.
const objectUrls = new Map();

/** A local URL for a saved file, or null when it is not saved. Never throws. */
export async function cachedFileUrl(fullPath) {
    if (objectUrls.has(fullPath)) return objectUrls.get(fullPath);
    if (!fileCacheAvailable()) return null;
    try {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(keyFor(fullPath));
        if (!hit) return null;
        const url = URL.createObjectURL(await hit.blob());
        objectUrls.set(fullPath, url);
        return url;
    } catch {
        return null;
    }
}

/** True when the file is saved. */
export async function isFileCached(fullPath) {
    if (!fileCacheAvailable()) return false;
    try {
        return !!(await (await caches.open(CACHE)).match(keyFor(fullPath)));
    } catch {
        return false;
    }
}

/** Saves a file's bytes. Returns the size saved. */
export async function putFile(fullPath, blob) {
    const cache = await caches.open(CACHE);
    await cache.put(keyFor(fullPath), new Response(blob, { headers: { 'content-type': blob.type || 'image/png' } }));
    return blob.size;
}

export async function removeFile(fullPath) {
    const url = objectUrls.get(fullPath);
    if (url) { URL.revokeObjectURL(url); objectUrls.delete(fullPath); }
    if (!fileCacheAvailable()) return;
    try { await (await caches.open(CACHE)).delete(keyFor(fullPath)); } catch { /* already gone */ }
}
