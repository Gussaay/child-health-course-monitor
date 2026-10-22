// src/components/imnci/onlineCourses/offline.js
//
// Saving a module to read without a connection.
//
// The text of every course is already on the device: the course items are
// cached in IndexedDB by DataContext and read from there offline. What is not
// is the pictures — figures and captured book pages, which come from Storage
// and are where the classification charts live. Saving a module downloads
// those into the device's file cache (fileCache.js).
//
// Which modules are saved is remembered per device in localStorage, with the
// files each one needed, so removing one module never deletes a page another
// saved module still shows (two modules can share a captured page).
import { assetPath, downloadUrl } from './assets';
import { fileCacheAvailable, isFileCached, putFile, removeFile } from './fileCache';

const KEY = 'onlineCourseOffline';

export const canSaveOffline = fileCacheAvailable;

/** { [moduleId]: { paths: [fullPath], bytes, savedAt } } */
export function savedModules() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}

function writeSaved(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode: nothing remembered */ }
}

/** The Storage paths of every picture in some sections, each once. */
export function picturePaths(sections) {
    const paths = sections
        .flatMap((s) => [...(s.read || []), ...(s.see || []), ...(s.practise || []), ...(s.blocks || [])])
        .filter((b) => (b?.type === 'image' || b?.type === 'page') && b.path)
        .map((b) => b.path);
    return [...new Set(paths)];
}

/**
 * Where a saved module stands against its sections now.
 * 'none' not saved; 'saved' every picture saved; 'stale' saved, but sections
 * have gained pictures since (an author converted or edited them).
 */
export function offlineState(record, sections) {
    if (!record) return 'none';
    const have = new Set(record.paths || []);
    return picturePaths(sections).every((p) => have.has(assetPath(p))) ? 'saved' : 'stale';
}

/**
 * Downloads the pictures of a module's sections. Files already saved are
 * kept, not fetched again. onProgress(done, total) after each file.
 * Returns { saved, failed, bytes }; the module counts as saved even with
 * failures, so what did arrive is used, and saving again retries the rest.
 */
export async function saveModuleOffline(moduleId, sections, onProgress = () => {}) {
    const paths = picturePaths(sections);
    let bytes = 0;
    let failed = 0;
    const done = [];
    for (let i = 0; i < paths.length; i++) {
        const full = assetPath(paths[i]);
        try {
            if (!(await isFileCached(full))) {
                const res = await fetch(await downloadUrl(paths[i]));
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                bytes += await putFile(full, await res.blob());
            }
            done.push(full);
        } catch (e) {
            failed += 1;
            console.warn('Could not save for offline:', full, e?.message);
        }
        onProgress(i + 1, paths.length);
    }
    // Nothing arrived (offline part way, or Storage refused): not saved.
    if (!done.length && paths.length) return { saved: 0, failed, bytes };
    const all = savedModules();
    all[moduleId] = { paths: done, bytes: (all[moduleId]?.bytes || 0) + bytes, savedAt: Date.now() };
    writeSaved(all);
    return { saved: done.length, failed, bytes };
}

/** Forgets a saved module and deletes the files no other saved module uses. */
export async function removeModuleOffline(moduleId) {
    const all = savedModules();
    const mine = all[moduleId]?.paths || [];
    delete all[moduleId];
    const stillUsed = new Set(Object.values(all).flatMap((r) => r.paths || []));
    for (const full of mine) {
        if (!stillUsed.has(full)) await removeFile(full);
    }
    writeSaved(all);
}
