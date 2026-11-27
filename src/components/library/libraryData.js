// Child Health Library: reading and writing `libraryItems`, and the library's
// files in Storage under library/. Everyone (signed in or not) may read;
// federal managers and super users write (firestore.rules / storage.rules).
import { db, storage } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { safeFileName } from '../../utils/uploadValidation';
import { LIBRARY_COLLECTION, LIBRARY_REQUESTS_COLLECTION, validateLibraryFile } from './libraryModel';

// The catalogue is kept on the device after every successful load, so the
// library's pages (services, sections, books) open and can be browsed with
// no connection at all; the next successful load replaces the copy.
const ITEMS_CACHE_KEY = 'libraryItemsCache.v1';

export async function listLibraryItems() {
    try {
        const snap = await getDocs(collection(db, LIBRARY_COLLECTION));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        try { localStorage.setItem(ITEMS_CACHE_KEY, JSON.stringify(items)); } catch { /* private mode */ }
        return items;
    } catch (error) {
        try {
            const cached = JSON.parse(localStorage.getItem(ITEMS_CACHE_KEY) || 'null');
            if (Array.isArray(cached)) return cached;
        } catch { /* no cache */ }
        throw error;
    }
}

// A photo is shrunk to at most 1200 px wide as a JPEG before upload: it is the
// thumbnail of every shared link, and WhatsApp skips large preview images
// (roughly over 300 KB). GIFs keep their animation; anything that cannot be
// drawn is uploaded as it is.
async function shrinkPhoto(file, maxWidth = 1200, quality = 0.82) {
    if (file.type === 'image/gif' || typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxWidth / bitmap.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {
        return file;
    }
}

/**
 * Starts uploading a photo ('image') or content file ('file') and returns a
 * handle to watch and control it: { promise, pause, resume, cancel }.
 * `promise` resolves { url, path } when the upload completes and rejects on
 * failure — with code 'storage/canceled' when cancelled. `onProgress` is
 * called with the fraction uploaded (0 to 1). The form starts uploads as
 * soon as a file is picked, so they run while the rest is filled in.
 */
export function startLibraryUpload(original, kind, onProgress) {
    let task = null;
    let cancelled = false;
    const promise = (async () => {
        const problem = validateLibraryFile(original, kind);
        if (problem) throw new Error(problem);
        const file = kind === 'image' ? await shrinkPhoto(original) : original;
        if (kind === 'image' && file.size >= 5 * 1024 * 1024) throw new Error('The photo is too large (limit 5 MB).');
        if (cancelled) {
            const error = new Error('Upload cancelled.');
            error.code = 'storage/canceled';
            throw error;
        }
        const path = kind === 'image'
            ? `uploads/library_${Date.now()}_${safeFileName(file.name)}`
            : `library/files/${Date.now()}_${safeFileName(file.name)}`;
        task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
        await new Promise((resolve, reject) => {
            task.on('state_changed',
                (snap) => { if (onProgress && snap.totalBytes) onProgress(snap.bytesTransferred / snap.totalBytes); },
                reject,
                resolve);
        });
        return { url: await getDownloadURL(task.snapshot.ref), path };
    })();
    return {
        promise,
        pause: () => { try { task?.pause(); } catch { /* not started yet */ } },
        resume: () => { try { task?.resume(); } catch { /* not started yet */ } },
        cancel: () => { cancelled = true; try { task?.cancel(); } catch { /* not started yet */ } },
    };
}

/** Uploads a photo ('image') or content file ('file'); returns { url, path }. */
export async function uploadLibraryFile(original, kind) {
    return startLibraryUpload(original, kind).promise;
}

export async function removeLibraryFile(path) {
    if (!path) return;
    try {
        await deleteObject(ref(storage, path));
    } catch (error) {
        if (error?.code !== 'storage/object-not-found') console.error('Library file delete failed:', error);
    }
}

export async function addLibraryItem(item, user) {
    const docRef = await addDoc(collection(db, LIBRARY_COLLECTION), {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.email || user?.uid || '',
    });
    return docRef.id;
}

export async function updateLibraryItem(id, item, user) {
    await updateDoc(doc(db, LIBRARY_COLLECTION, id), {
        ...item,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || user?.uid || '',
    });
}

export async function deleteLibraryItem(item) {
    await deleteDoc(doc(db, LIBRARY_COLLECTION, item.id));
    await Promise.all([removeLibraryFile(item.imagePath), removeLibraryFile(item.filePath)]);
}

/**
 * A visitor asking to be emailed when a draft item becomes final. Anyone may
 * register (firestore.rules checks the fields); the address is only read by
 * library managers and by the notify function.
 */
export async function addLibraryRequest(itemId, { name, email, phone, lang }) {
    await addDoc(collection(db, LIBRARY_REQUESTS_COLLECTION), {
        itemId,
        name: String(name || '').trim(),
        email: String(email || '').trim(),
        phone: String(phone || '').trim(),
        lang: lang === 'ar' ? 'ar' : 'en',
        createdAt: serverTimestamp(),
    });
}

/** Every registration, for the managers' "people waiting" counts. */
export async function listLibraryRequests() {
    const snap = await getDocs(collection(db, LIBRARY_REQUESTS_COLLECTION));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
