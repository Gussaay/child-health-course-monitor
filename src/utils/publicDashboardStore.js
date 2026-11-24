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
 * Fetches the package: first the manifest (each list's version and page
 * count, or unchanged for lists the device holds at that version), then the
 * pages of every changed list, a few at a time. A list that moves on while
 * its pages arrive is fetched again (at most twice).
 *   held        the package on the device, or null
 *   manifestOf  (versions) => manifest
 *   fetchPage   (list, page, version) => { items } | { stale: true }
 */
export async function fetchPublicPackage({ held, manifestOf, fetchPage, parallel = 4 }) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const manifest = await manifestOf(held?.versions || {});
        const out = { versions: {} };
        const jobs = [];
        let stale = false;
        for (const list of PACKAGE_PARTS) {
            const m = manifest?.[list];
            if (!m) throw new Error(`The dashboard data is incomplete (${list}).`);
            out.versions[list] = m.version || null;
            if (m.unchanged && held && Array.isArray(held[list])) { out[list] = held[list]; continue; }
            if (m.unchanged) { held = null; stale = true; break; } // told unchanged but not held: start over
            const pages = new Array(Math.max(1, m.pages || 1));
            out[list] = pages;
            for (let i = 0; i < pages.length; i += 1) jobs.push({ list, i, version: m.version, pages });
        }
        if (stale) continue;
        let next = 0;
        const worker = async () => {
            while (next < jobs.length && !stale) {
                const job = jobs[next++];
                const res = await fetchPage(job.list, job.i, job.version);
                if (res?.stale) { stale = true; return; }
                if (!Array.isArray(res?.items)) throw new Error(res?.error || 'The dashboard data could not be loaded.');
                job.pages[job.i] = res.items;
            }
        };
        await Promise.all(Array.from({ length: Math.min(parallel, jobs.length || 1) }, worker));
        if (stale) continue;
        PACKAGE_PARTS.forEach((list) => {
            if (out[list] !== held?.[list]) out[list] = [].concat(...out[list]);
        });
        return out;
    }
    throw new Error('The dashboard data kept changing while it loaded. Refresh the page.');
}
