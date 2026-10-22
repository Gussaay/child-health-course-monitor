// src/components/imnci/onlineCourses/assets.js
//
// Where a course asset lives in Storage. The legacy path from the Android app
// ("imnci/Books/module 1 introduction.pdf") is kept verbatim underneath, so a
// migrated section's reference resolves without rewriting any content.
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebase';
import { cachedFileUrl } from './fileCache';

export const ASSET_ROOT = 'online-courses';
export const assetPath = (legacyPath) => `${ASSET_ROOT}/${String(legacyPath || '').replace(/^\/+/, '')}`;

// Download links, kept for the session. A captured page is shown on Read
// (Compare), on See and in the editor, and moving between the tabs used to ask
// Storage for the same link again each time. A failed lookup is not kept, so a
// figure uploaded a moment later still appears.
const urls = new Map();

/** The Storage download link for a course file. Needs a connection. */
export function downloadUrl(path) {
    const full = assetPath(path);
    if (!urls.has(full)) {
        urls.set(full, getDownloadURL(storageRef(storage, full)).catch((e) => {
            urls.delete(full);
            throw e;
        }));
    }
    return urls.get(full);
}

/**
 * Where to show a course file from: the copy saved on the device when the
 * module was saved for offline, otherwise Storage.
 */
export async function assetUrl(path) {
    return (await cachedFileUrl(assetPath(path))) || downloadUrl(path);
}
