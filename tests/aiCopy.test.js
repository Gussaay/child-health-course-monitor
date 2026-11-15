// The data assistant counts health facilities from the server's kept copy when
// that gives exactly what the database query would (functions/aiCopy.js).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCopyReader, conditionsFor, applicable, matches } = require('../functions/aiCopy.js');

const ts = (ms) => ({ toMillis: () => ms });
const Timestamp = { fromMillis: (ms) => ({ ms }) };
const STATE = 'الولاية';
const LOC = 'المحلية';
const spec = { scope: { state: STATE, locality: LOC } };

function fakeDb(initial) {
    const facilities = new Map(Object.entries(initial));
    const stored = new Map();
    const reads = { full: 0 };
    const snap = (id, data) => ({ id, exists: data !== undefined, data: () => data });
    const storeDoc = (p) => ({ path: p, get: async () => snap(p, stored.get(p)), collection: (n) => ({ doc: (id) => storeDoc(`${p}/${n}/${id}`) }) });
    return {
        reads,
        collection: (name) => name === 'healthFacilities' ? {
            get: async () => { reads.full += 1; return { size: facilities.size, docs: [...facilities].map(([id, d]) => snap(id, d)) }; },
            where: (_f, _o, v) => ({ get: async () => { const docs = [...facilities].filter(([, d]) => d.lastSnapshotAt.toMillis() > v.ms).map(([id, d]) => snap(id, d)); return { size: docs.length, docs }; } }),
            count: () => ({ get: async () => ({ data: () => ({ count: facilities.size }) }) }),
        } : { doc: (id) => storeDoc(`${name}/${id}`) },
        batch: () => { const ops = []; return { set: (r, d) => ops.push(() => stored.set(r.path, d)), delete: () => {}, commit: async () => ops.forEach((o) => o()) }; },
    };
}
const fac = (state, loc, working, extra = {}) => ({ [STATE]: state, [LOC]: loc, 'هل_المؤسسة_تعمل': working, lastSnapshotAt: ts(1000), imnci_staff: [{ name: 'A' }], ...extra });

describe('conditions', () => {
    it('adds the caller scope after the request filters, as the database query does', () => {
        const c = conditionsFor({ manageScope: 'state', manageLocation: 'Kassala' }, spec, [{ field: LOC, op: '==', value: 'X' }]);
        expect(c).toEqual([{ field: LOC, op: '==', value: 'X' }, { field: STATE, op: '==', value: 'Kassala' }]);
        expect(conditionsFor({ manageScope: 'all', manageLocation: '' }, spec, [])).toEqual([]);
    });

    it('matches like Firestore: a missing field matches nothing', () => {
        expect(matches({ a: 1 }, { field: 'b', op: '!=', value: 2 })).toBe(false);
        expect(matches({ a: 'x' }, { field: 'a', op: '!=', value: 'y' })).toBe(true);
        expect(matches({ a: 'x' }, { field: 'a', op: 'in', value: ['x', 'z'] })).toBe(true);
        expect(matches({ a: 5 }, { field: 'a', op: '>', value: 3 })).toBe(true);
        expect(matches({ a: 'text' }, { field: 'a', op: '>', value: 3 })).toBe(false);
    });

    it('leaves anything uncertain to the database', () => {
        expect(applicable([{ field: 'imnci_staff', op: '==', value: 'x' }])).toBe(false); // field the copy drops
        expect(applicable([{ field: 'a.b', op: '==', value: 'x' }])).toBe(false);
        expect(applicable([{ field: 'a', op: 'array-contains', value: 'x' }])).toBe(false);
        expect(applicable([{ field: 'a', op: '==', value: { x: 1 } }])).toBe(false);
        expect(applicable([{ field: 'a', op: '==', value: 'x' }])).toBe(true);
    });
});

describe('facilities from the kept copy', () => {
    const data = { f1: fac('Kassala', 'A', 'Yes'), f2: fac('Kassala', 'B', 'No'), f3: fac('Sennar', 'C', 'Yes'), f4: fac('Kassala', 'A', 'Yes', { isDeleted: true }) };
    const reader = () => createCopyReader({ db: fakeDb(data), Timestamp, now: () => 1_000_000 });

    it('returns the caller\'s own facilities that pass the filters, never a deleted one', async () => {
        const rows = await reader().facilities({ manageScope: 'state', manageLocation: 'Kassala' }, spec, 'healthFacilities', [{ field: 'هل_المؤسسة_تعمل', op: '==', value: 'Yes' }], [LOC, 'isDeleted']);
        expect(rows.map((r) => r.id).sort()).toEqual(['f1']);
    });

    it('federal scope sees every state', async () => {
        const rows = await reader().facilities({ manageScope: 'all', manageLocation: '' }, spec, 'healthFacilities', [], [STATE]);
        expect(rows.map((r) => r.id).sort()).toEqual(['f1', 'f2', 'f3']);
    });

    it('declines other lists and fields the copy drops, so the database is read', async () => {
        const r = reader();
        const access = { manageScope: 'all', manageLocation: '' };
        expect(await r.facilities(access, spec, 'participants', [], [STATE])).toBeNull();
        expect(await r.facilities(access, spec, 'healthFacilities', [], ['imnci_staff'])).toBeNull();
        expect(await r.facilities(access, spec, 'healthFacilities', [{ field: 'imnci_staff', op: '==', value: 'x' }], [STATE])).toBeNull();
    });

    it('reads the database once, then answers from memory', async () => {
        const db = fakeDb(data);
        const r = createCopyReader({ db, Timestamp, now: () => 1_000_000 });
        const access = { manageScope: 'all', manageLocation: '' };
        await r.facilities(access, spec, 'healthFacilities', [], [STATE]);
        await r.facilities(access, spec, 'healthFacilities', [], [LOC]);
        expect(db.reads.full).toBe(1);
    });
});
