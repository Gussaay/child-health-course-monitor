// src/components/aiLibrary/aiLibraryData.js
//
// Firestore layout of the AI Library:
//   aiBooks/{id}                    { title, service, courseId, moduleId, fileName, pageCount, textPages,
//                                     sections: [{ title, from, to, level }],
//                                     isDeleted, createdAt, updatedAt, createdBy, createdByName }
//   aiBooks/{id}/pages/{part}       { from, to, pages: [text] }   written once, when the book is added
//   aiBooks/{id}/summaries/{id}     written by the aiBooks Cloud Function only
//
// The AI itself is reached only through the aiBooks callable, which holds the
// keys and reads the page text on the server.
//
// A book belongs to Online Courses: courseId (and, for a module book, moduleId)
// say which course it serves. Adding or editing a book writes only under
// aiBooks; it never touches onlineCourses or onlineCourseItems.
import { collection, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from '../../firebase';
import { getDocs, setDoc, updateDoc, deleteDoc, writeBatch } from '../../data';
import { packPages } from './bookText';

const books = () => collection(db, 'aiBooks');

export async function listBooks() {
    const snap = await getDocs(books());
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

/**
 * Adds a book read by readBook(). The page text goes first and the book
 * document last, so a half-finished upload never shows in the list.
 */
export async function addBook({ title, service, courseId, moduleId, fileName, pages, sections, textPages }, onProgress = () => {}) {
    const ref = doc(books());
    const parts = packPages(pages);
    for (let i = 0; i < parts.length; i++) {
        await setDoc(doc(ref, 'pages', String(i).padStart(3, '0')), parts[i]);
        onProgress(i + 1, parts.length);
    }
    const user = auth.currentUser;
    await setDoc(ref, {
        title, service, courseId: courseId || '', moduleId: moduleId || '', fileName: fileName || '', pageCount: pages.length, textPages: textPages || 0,
        sections, isDeleted: false,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        createdBy: user?.uid || '', createdByName: user?.displayName || user?.email || '',
    });
    return ref.id;
}

export const updateBook = (id, changes) =>
    updateDoc(doc(db, 'aiBooks', id), { ...changes, updatedAt: serverTimestamp() });

export const setBookDeleted = (id, isDeleted) =>
    updateDoc(doc(db, 'aiBooks', id), {
        isDeleted, deletedAt: isDeleted ? serverTimestamp() : null, updatedAt: serverTimestamp(),
    });

/** Removes a book for good: its pages, its saved summaries, then the book. */
export async function deleteBookForever(id) {
    const ref = doc(db, 'aiBooks', id);
    for (const sub of ['pages', 'summaries']) {
        const snap = await getDocs(collection(ref, sub));
        for (let i = 0; i < snap.docs.length; i += 400) {
            const batch = writeBatch(db);
            snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
    }
    await deleteDoc(ref);
}

export async function listSummaries(bookId) {
    const snap = await getDocs(query(collection(db, 'aiBooks', bookId, 'summaries'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export const deleteSummary = (bookId, id) => deleteDoc(doc(db, 'aiBooks', bookId, 'summaries', id));

// Summaries of a long chapter can take a minute or two; the default callable
// timeout (70 s) would give up while the function is still working.
const aiBooksFn = () => httpsCallable(getFunctions(), 'aiBooks', { timeout: 300000 });

export async function summarise({ bookId, from, to, style, lang, sectionTitle }) {
    const { data } = await aiBooksFn()({ task: 'summary', bookId, from, to, style, lang, sectionTitle });
    return data;
}

// One scope per question: a section, a book (or pages of it), a course's
// books, or a service's books.
export async function ask({ sectionId, bookId, courseId, service, from, to, question, messages, lang }) {
    const { data } = await aiBooksFn()({ task: 'ask', sectionId, bookId, courseId, service, from, to, question, messages, lang });
    return data;
}

// A course section's summary. Shared: the first learner's request is kept and
// the next ones get it at once. `fresh` (course authors only) makes a new one.
export async function summariseSection({ sectionId, style, lang, fresh = false }) {
    const { data } = await aiBooksFn()({ task: 'sectionSummary', sectionId, style, lang, fresh });
    return data;
}

// The AI book import: one section's raw PDF text back as clean reading text.
// Saves nothing; the author compares it and chooses.
export async function tidySection({ number, title, text }) {
    const { data } = await aiBooksFn()({ task: 'tidySection', number, title, text });
    return data;
}
