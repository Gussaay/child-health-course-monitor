// src/components/library/libraryDownload.js
//
// Keeping a library book on the device. The copy lives in the app's
// downloads folder (Documents/NCHP_Downloads — the same folder
// src/utils/fileDownloader.js downloads into and the Downloads screen
// lists), so a library book appears there too. The library never shows the
// book's link: the Download button fetches the file inside the app, and the
// saved copy can be read, sent to someone, or opened in another app.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Share } from '@capacitor/share';
import { bookMimeType, downloadedFileName } from './libraryModel';

const DIR = 'NCHP_Downloads';
const INDEX_KEY = 'libraryDownloads.v1';

const isNative = () => Capacitor.isNativePlatform();
const readIndex = () => {
    try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '{}') || {}; } catch { return {}; }
};
const writeIndex = (idx) => {
    try { localStorage.setItem(INDEX_KEY, JSON.stringify(idx)); } catch { /* private mode */ }
};
const pathFor = (item) => `${DIR}/${downloadedFileName(item)}`;

/**
 * The book's downloaded copy ({ fileName, path, at }), or null. On a phone
 * the file itself is checked, so a copy deleted elsewhere is not reported;
 * on the web the record of the download is what there is.
 */
export async function downloadedBook(item) {
    const entry = readIndex()[item?.id];
    if (!entry) return null;
    if (!isNative()) return entry;
    try {
        await Filesystem.stat({ path: entry.path, directory: Directory.Documents });
        return entry;
    } catch {
        const idx = readIndex();
        delete idx[item.id];
        writeIndex(idx);
        return null;
    }
}

/** Downloads the book inside the app; onProgress is called with 0..1. */
export async function downloadBook(item, onProgress) {
    const fileName = downloadedFileName(item);
    if (!isNative()) {
        // The browser keeps its own downloads; the library records that the
        // book was taken so it is not fetched again from here.
        window.open(item.linkUrl, '_blank', 'noopener,noreferrer');
        const entry = { fileName, path: null, at: Date.now() };
        const idx = readIndex();
        idx[item.id] = entry;
        writeIndex(idx);
        return entry;
    }
    try { await Filesystem.mkdir({ path: DIR, directory: Directory.Documents, recursive: true }); } catch { /* exists */ }
    let listener = null;
    if (onProgress) {
        try {
            listener = await Filesystem.addListener('progress', (p) => {
                if (p?.contentLength > 0) onProgress(Math.min(1, p.bytes / p.contentLength));
            });
        } catch { /* progress events not available */ }
    }
    try {
        await Filesystem.downloadFile({
            url: item.linkUrl,
            path: pathFor(item),
            directory: Directory.Documents,
            progress: true,
            recursive: true,
        });
    } finally {
        try { listener?.remove?.(); } catch { /* noop */ }
    }
    const entry = { fileName, path: pathFor(item), at: Date.now() };
    const idx = readIndex();
    idx[item.id] = entry;
    writeIndex(idx);
    return entry;
}

async function localUri(item) {
    const entry = readIndex()[item?.id];
    if (!entry?.path) return null;
    const { uri } = await Filesystem.getUri({ path: entry.path, directory: Directory.Documents });
    return uri;
}

/** Reads the saved copy: with the usual reader, or via the app chooser. */
export async function openDownloadedBook(item, { chooseApp = false } = {}) {
    if (!isNative()) {
        window.open(item.linkUrl, '_blank', 'noopener,noreferrer');
        return;
    }
    const uri = await localUri(item);
    if (!uri) throw new Error('The downloaded copy is missing.');
    await FileOpener.open({ filePath: uri, contentType: bookMimeType(item), openWithDefault: !chooseApp });
}

/** Sends the saved copy itself to someone (the share sheet's file share). */
export async function shareDownloadedBook(item) {
    if (isNative()) {
        const uri = await localUri(item);
        if (!uri) throw new Error('The downloaded copy is missing.');
        await Share.share({ title: item.name, files: [uri] });
        return;
    }
    if (navigator.share) {
        await navigator.share({ title: item.name, url: item.linkUrl });
        return;
    }
    throw new Error('Sharing is not available here.');
}

export async function removeDownloadedBook(item) {
    const idx = readIndex();
    const entry = idx[item?.id];
    if (isNative() && entry?.path) {
        try { await Filesystem.deleteFile({ path: entry.path, directory: Directory.Documents }); } catch { /* already gone */ }
    }
    delete idx[item.id];
    writeIndex(idx);
}
