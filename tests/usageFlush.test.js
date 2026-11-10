// The monthly usage record is written every five minutes (not on every burst
// of activity), when the app goes to the background, and never when signed out.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const writes = [];
let authCallback = null;
vi.mock('../src/firebase', () => ({ db: {}, auth: {}, storage: {}, isOnline: () => true }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_a, cb) => { authCallback = cb; return () => {}; } }));
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => async () => ({}) }));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn(), deleteObject: vi.fn() }));
vi.mock('firebase/firestore', async (importOriginal) => {
    const real = await importOriginal();
    return {
        ...real,
        doc: (_db, col, id) => ({ type: 'document', col, id, parent: { id: col } }),
        setDoc: async (ref, data) => { writes.push({ col: ref.col, id: ref.id, data }); },
        getDocs: async () => ({ docs: [{}, {}, {}], metadata: { fromCache: false } }),
        increment: (n) => ({ inc: n }),
        serverTimestamp: () => 'ts',
    };
});

import { initializeUsageTracking, getDocs } from '../src/data';
import { resetLedger, setUsageView } from '../src/utils/usageLedger';

const monthly = () => writes.filter((w) => w.col === 'usageMonthly');
const signIn = async () => { await authCallback({ uid: 'u1', email: 'u1@x.org' }); };
const readCourses = () => getDocs({ type: 'collection', id: 'courses' });

describe('monthly usage flush', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        writes.length = 0;
        resetLedger();
        initializeUsageTracking();
    });
    afterEach(() => { vi.useRealTimers(); });

    it('writes once every five minutes, however much happens in between', async () => {
        await signIn();
        setUsageView('courses');
        for (let i = 0; i < 40; i += 1) await readCourses();      // many bursts: no monthly write yet
        await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
        expect(monthly()).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(61 * 1000);             // five minutes in
        expect(monthly()).toHaveLength(1);
        const w = monthly()[0];
        expect(w.id).toMatch(/^\d{4}-\d{2}_u1$/);
        expect(w.data.reads).toEqual({ inc: 120 });               // 40 reads of 3 documents
        expect(w.data.byCollection.courses).toEqual({ r: { inc: 120 } });
        expect(w.data.byView.courses).toEqual({ r: { inc: 120 } });
        expect(w.data.trackingWrites).toEqual({ inc: 1 });
        // nothing new: no further write
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
        expect(monthly()).toHaveLength(1);
    });

    it('writes at once when the app goes to the background', async () => {
        await signIn();
        await readCourses();
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        expect(monthly()).toHaveLength(1);
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    });

    it('does not credit one person\'s counts to the next who signs in', async () => {
        await signIn();
        await readCourses();
        await authCallback(null);                                  // signs out
        await signIn();
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000);
        expect(monthly()).toHaveLength(0);
    });
});
