// src/utils/publicDashboardStore.js
//
// The public mentorship dashboard keeps the last package it received from the
// server (functions/publicMentorshipCopy.js) on the device, so a returning
// visitor sees the dashboard at once while the new data loads, and the server
// only sends the lists that changed. Its own small IndexedDB database: the
// public page runs without the app's data cache. Every failure just means
// "nothing saved"; the page then waits for the server as before.

const DB_NAME = 'PublicDashboardCache';
const STORE = 'packages';

function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('no IndexedDB')); return; }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function readPublicPackage(key) {
    try {
        const db = await openDb();
        return await new Promise((resolve) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
}

export async function savePublicPackage(key, value) {
    try {
        const db = await openDb();
        await new Promise((resolve) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
            try { tx.objectStore(STORE).put(value, key); } catch { resolve(false); }
        });
    } catch { /* not saved: the next visit waits for the server */ }
}

export const PACKAGE_PARTS = ['submissions', 'imnci', 'eenc', 'facilities'];

/**
 * The new package from the server's answer and the package held: a part the
 * server reports unchanged keeps the held copy. Returns null when a part is
 * missing from both (the caller then asks again without versions).
 */
export function mergePublicPackage(held, answer) {
    const out = { versions: {} };
    for (const part of PACKAGE_PARTS) {
        const a = answer?.[part];
        if (a?.tooLarge) return { tooLarge: true };
        if (a && Array.isArray(a.items)) {
            out[part] = a.items;
        } else if (a?.unchanged && held && Array.isArray(held[part])) {
            out[part] = held[part];
        } else {
            return null;
        }
        out.versions[part] = a.version || null;
    }
    return out;
}
