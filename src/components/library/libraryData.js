// Child Health Library: reading and writing `libraryItems`, and the library's
// files in Storage under library/. Everyone (signed in or not) may read;
// federal managers and super users write (firestore.rules / storage.rules).
import { db, storage } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { safeFileName } from '../../utils/uploadValidation';
import { LIBRARY_COLLECTION, validateLibraryFile } from './libraryModel';

export async function listLibraryItems() {
    const snap = await getDocs(collection(db, LIBRARY_COLLECTION));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Uploads a photo ('image') or content file ('file'); returns { url, path }. */
export async function uploadLibraryFile(file, kind) {
    const problem = validateLibraryFile(file, kind);
    if (problem) throw new Error(problem);
    const path = `library/${kind === 'image' ? 'images' : 'files'}/${Date.now()}_${safeFileName(file.name)}`;
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
