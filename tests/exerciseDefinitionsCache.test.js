// Exercise definitions are kept on the device and only changes are read
// from the server (src/data.js getCachedExerciseDefinitions).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const server = { docs: {}, reads: 0, queries: [] };
const ts = (ms) => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 });

vi.mock('../src/firebase', () => ({ db: {}, auth: {}, storage: {}, isOnline: () => true }));
vi.mock('firebase/firestore', async (importOriginal) => {
    const orig = await importOriginal();
    const snapOf = (list) => ({
        empty: list.length === 0,
        metadata: { fromCache: false },
        docs: list.map((d) => ({ id: d.id, data: () => ({ ...d }) })),
    });
    return {
        ...orig,
        collection: (_db, name) => ({ name, type: 'collection' }),
        query: (c, ...w) => ({ ...c, where: w }),
        where: (field, op, value) => ({ field, op, value }),
        Timestamp: { fromMillis: (ms) => ({ ms }) },
        getDocs: async (q) => {
            const since = q.where?.[0]?.value?.ms;
            const list = Object.values(server.docs).filter((d) => since == null || d.lastUpdatedAt.toMillis() > since);
            server.reads += Math.max(1, list.length);
            server.queries.push(since == null ? 'full' : 'delta');
            return snapOf(list);
        },
        getCountFromServer: async () => { server.reads += 1; return { data: () => ({ count: Object.keys(server.docs).length }) }; },
    };
});

// A small IndexedDB that outlives module reloads (a new app session).
const idb = new Map();
globalThis.indexedDB = {
    open: () => {
        const req = {};
        setTimeout(() => {
            req.result = {
                objectStoreNames: { contains: () => true },
                createObjectStore: () => {},
                transaction: () => {
                    const tx = {};
                    tx.objectStore = () => ({
                        get: (k) => { const r = { result: idb.get(k) }; setTimeout(() => tx.oncomplete?.(), 0); return r; },
                        put: (v, k) => { idb.set(k, JSON.parse(JSON.stringify(v))); setTimeout(() => tx.oncomplete?.(), 0); return {}; },
                    });
                    return tx;
                },
            };
            req.onsuccess?.();
        }, 0);
        return req;
    },
};

const BASE = 1.79e12;
const put = (id, ms, extra = {}) => { server.docs[id] = { id, title: id, order: 1, lastUpdatedAt: ts(BASE + ms), ...extra }; };
const freshSession = async () => { vi.resetModules(); return import('../src/data.js'); };

describe('exercise definitions on the device', () => {
    beforeEach(() => { server.docs = {}; server.reads = 0; server.queries = []; idb.clear(); });

    it('downloads once, then reads only changes in later sessions', async () => {
        for (let i = 0; i < 50; i++) put(`ex${i}`, i * 600000);
        let data = await freshSession();
        expect((await data.getCachedExerciseDefinitions()).length).toBe(50);
        expect(server.queries).toEqual(['full']);
        expect(server.reads).toBe(50);

        // New session, nothing changed: a count check and a delta holding only
        // the newest exercise (it sits inside the one-minute overlap).
        server.reads = 0; server.queries = [];
        data = await freshSession();
        expect((await data.getCachedExerciseDefinitions()).length).toBe(50);
        expect(server.queries).toEqual(['delta']);
        expect(server.reads).toBe(2);

        // One edited, one soft-deleted, one added.
        put("ex3", 90000000, { title: 'edited' });
        put("ex4", 90000001, { isDeleted: true });
        put("new", 90000002);
        server.reads = 0; server.queries = [];
        data = await freshSession();
        const list = await data.getCachedExerciseDefinitions();
        expect(list.length).toBe(50);
        expect(list.find((e) => e.id === 'ex3').title).toBe('edited');
        expect(list.some((e) => e.id === 'ex4')).toBe(false);
        expect(list.some((e) => e.id === 'new')).toBe(true);
        expect(server.queries).toEqual(['delta']);
        // count + the 3 changes + the newest old one, inside the one-minute overlap
        expect(server.reads).toBe(5);
    });

    it('reads everything again when the server holds fewer exercises (hard delete)', async () => {
        for (let i = 0; i < 5; i++) put(`ex${i}`, i * 600000);
        let data = await freshSession();
        await data.getCachedExerciseDefinitions();
        delete server.docs.ex2;
        server.queries = [];
        data = await freshSession();
        const list = await data.getCachedExerciseDefinitions();
        expect(list.map((e) => e.id)).not.toContain('ex2');
        expect(server.queries).toEqual(['full']);
    });

    it('reuses the answer for a minute within a session', async () => {
        put('a', 1000);
        const data = await freshSession();
        await data.getCachedExerciseDefinitions();
        server.queries = [];
        await data.getCachedExerciseDefinitions();
        expect(server.queries).toEqual([]);
        await data.getCachedExerciseDefinitions({ force: true });
        expect(server.queries).toEqual(['delta']);
    });
});
