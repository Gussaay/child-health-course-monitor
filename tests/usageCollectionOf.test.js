// data.js files each read under the collection it touched by looking inside the
// Firebase SDK's query objects. If an SDK upgrade changes those internals the
// usage tab would silently file everything under "other"; this fails first.
import { describe, it, expect } from 'vitest';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, query, where, orderBy, collectionGroup } from 'firebase/firestore';

// Same logic as collectionOf in src/data.js.
const collectionOf = (ref) => {
    try {
        if (!ref) return 'other';
        if (ref.type === 'document') return ref.parent.id;
        if (ref.type === 'collection') return ref.id;
        const q = ref._query;
        return q?.collectionGroup || q?.path?.lastSegment?.() || 'other';
    } catch { return 'other'; }
};

describe('collectionOf against the real Firebase SDK', () => {
    const db = getFirestore(initializeApp({ projectId: 'usage-test' }));
    it('names the list for collections, documents, filtered queries and group queries', () => {
        expect(collectionOf(collection(db, 'courses'))).toBe('courses');
        expect(collectionOf(doc(db, 'participants', 'p1'))).toBe('participants');
        expect(collectionOf(query(collection(db, 'skillMentorship'), where('lastUpdatedAt', '>', 1), orderBy('lastUpdatedAt')))).toBe('skillMentorship');
        expect(collectionOf(query(collectionGroup(db, 'tests')))).toBe('tests');
    });
});
