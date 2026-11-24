// Child Health Library: reading and writing `libraryItems`, and the library's
// files in Storage under library/. Everyone (signed in or not) may read;
// federal managers and super users write (firestore.rules / storage.rules).
import { db, storage } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { safeFileName } from '../../utils/uploadValidation';
import { LIBRARY_COLLECTION, LIBRARY_REQUESTS_COLLECTION, validateLibraryFile } from './libraryModel';

export async function listLibraryItems() {
    const snap = await getDocs(collection(db, LIBRARY_COLLECTION));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

/** Uploads a photo ('image') or content file ('file'); returns { url, path }. */
export async function uploadLibraryFile(original, kind) {
    const problem = validateLibraryFile(original, kind);
    if (problem) throw new Error(problem);
    const file = kind === 'image' ? await shrinkPhoto(original) : original;
    // Photos go to the app's public uploads/ folder (images up to 5 MB, readable
    // by anyone), which needs no rules of its own; content files, which can be
    // larger and of more types, go to library/ (storage.rules).
    if (kind === 'image' && file.size >= 5 * 1024 * 1024) throw new Error('The photo is too large (limit 5 MB).');
    const path = kind === 'image'
        ? `uploads/library_${Date.now()}_${safeFileName(file.name)}`
        : `library/files/${Date.now()}_${safeFileName(file.name)}`;
    const snapshot = await uploadBytes(ref(storage, path), file, { contentType: file.type });
    return { url: await getDownloadURL(snapshot.ref), path };
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
