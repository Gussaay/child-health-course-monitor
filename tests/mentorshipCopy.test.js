// Tier "a" (docs/server-dashboard-kpis.md): a device's first download of the
// mentorship lists can come from a server copy (functions/mentorshipCopyCore.js).
// Records must arrive whole, with server timestamps in the shape the app keeps
// on the device, so the app cannot tell them from a database read.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { fetchPagedList } from '../src/dashboards/serverCopy';

const require = createRequire(import.meta.url);
const { makeMentorshipCopy } = require('../functions/mentorshipCopyCore.js');

const ts = (ms) => ({ toMillis: () => ms, _seconds: Math.floor(ms / 1000), _nanoseconds: (ms % 1000) * 1e6 });

function fakeDb(data) {
    const docs = (map) => Array.from(map.entries()).map(([id, d]) => ({ id, data: () => d }));
    const store = new Map();
    const storeDoc = (p) => ({ get: async () => ({ exists: store.has(p), data: () => store.get(p) }), collection: (n) => ({ doc: (id) => storeDoc(`${p}/${n}/${id}`) }), path: p });
    return {
        collection: (name) => {
            if (name === '_dashboardCopies') return { doc: (id) => storeDoc(id) };
            const map = data[name] || new Map();
            return {
                get: async () => ({ size: map.size, docs: docs(map) }),
                where: (_f, _op, since) => ({ get: async () => { const d = docs(map).filter((x) => x.data().lastUpdatedAt.toMillis() > since.ms); return { size: d.length, docs: d }; } }),
                count: () => ({ get: async () => ({ data: () => ({ count: map.size }) }) }),
            };
        },
        batch: () => { const ops = []; return { set: (ref, v) => ops.push([ref.path, v]), delete: () => {}, commit: async () => ops.forEach(([p, v]) => store.set(p, v)) }; },
    };
}

describe('mentorship server copy', () => {
    const data = {
        skillMentorship: new Map([
            ['s1', { healthWorkerName: 'Amna', mentorEmail: 'm@x.org', scores: { overall: 80 }, effectiveDate: ts(1700000000500), cases: [{ at: ts(1700000001000), ok: true }], lastUpdatedAt: ts(1700000002000) }],
            ['s2', { healthWorkerName: 'Ali', isDeleted: true, lastUpdatedAt: ts(1700000003000) }],
        ]),
        imnciVisitReports: new Map([['r1', { facilityId: 'f1', challenges_table: [{ problem: 'p', status: 'Done' }], lastUpdatedAt: ts(1700000004000) }]]),
        eencVisitReports: new Map(),
    };
    let clock = 10_000_000;
    const copy = makeMentorshipCopy({ db: fakeDb(data), Timestamp: { fromMillis: (ms) => ({ ms }) }, now: () => clock });
    const call = async (req) => (typeof req.list === 'string' ? copy.page(req.list, req.page, req.version) : copy.manifest(req.versions || {}, req.lists || null));

    it('sends records whole, timestamps as { seconds, nanoseconds }, deleted ones included', async () => {
        const items = await fetchPagedList({ list: 'skillMentorshipSubmissions', manifestOf: (lists) => call({ lists }), fetchPage: (list, page, version) => call({ list, page, version }) });
        const s1 = items.find((r) => r.id === 's1');
        expect(s1).toEqual({
            id: 's1', healthWorkerName: 'Amna', mentorEmail: 'm@x.org', scores: { overall: 80 },
            effectiveDate: { seconds: 1700000000, nanoseconds: 500000000 },
            cases: [{ at: { seconds: 1700000001, nanoseconds: 0 }, ok: true }],
            lastUpdatedAt: { seconds: 1700000002, nanoseconds: 0 },
        });
        expect(items.map((r) => r.id).sort()).toEqual(['s1', 's2']);
        const reports = await fetchPagedList({ list: 'imnciVisitReports', manifestOf: (lists) => call({ lists }), fetchPage: (list, page, version) => call({ list, page, version }) });
        expect(reports[0].challenges_table).toEqual([{ problem: 'p', status: 'Done' }]);
    });

    it('keeps up with changes, and only the lists asked are listed', async () => {
        clock += 5 * 60 * 1000;
        data.skillMentorship.set('s3', { healthWorkerName: 'New', lastUpdatedAt: ts(1700000009000) });
        const m = await call({ lists: ['skillMentorshipSubmissions'] });
        expect(Object.keys(m)).toEqual(['skillMentorshipSubmissions']);
        expect(m.skillMentorshipSubmissions.count).toBe(3);
        expect(await call({ list: 'skillMentorshipSubmissions', page: 0, version: 'old' })).toMatchObject({ stale: true });
        expect(await call({ list: 'nope', page: 0 })).toEqual({ error: 'unknown list' });
    });

    it('the browser joins pages and starts again when the list moves on', async () => {
        let round = 0;
        const items = await fetchPagedList({
            list: 'x',
            manifestOf: async () => { round += 1; return { x: { version: `v${round}`, pages: 2 } }; },
            fetchPage: async (_l, page, version) => (version === 'v1' && page === 1 ? { stale: true } : { items: [{ id: `${version}-${page}` }] }),
        });
        expect(round).toBe(2);
        expect(items).toEqual([{ id: 'v2-0' }, { id: 'v2-1' }]);
        await expect(fetchPagedList({ list: 'x', manifestOf: async () => ({}), fetchPage: async () => ({}) })).rejects.toThrow();
    });
});
