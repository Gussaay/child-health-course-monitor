// The Dashboard copy of the health facilities (functions/facilityDashboardCopyCore.js):
// which fields it keeps, how it stays current, and that it never drops a
// field the dashboards or the main-menu coverage read.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { makeCore, slimFacility, DROP_KEY, FULL_REBUILD_MS } = require('../functions/facilityDashboardCopyCore.js');

const ts = (ms) => ({ toMillis: () => ms });
const Timestamp = { fromMillis: (ms) => ({ ms }) };

// A tiny stand-in for the admin Firestore, enough for the core.
function fakeDb(initial) {
    const facilities = new Map(Object.entries(initial));
    const stored = new Map();
    const reads = { full: 0, delta: 0, count: 0 };
    const docSnap = (id, data) => ({ id, exists: data !== undefined, data: () => data });
    const storeDoc = (path) => ({
        path,
        get: async () => docSnap(path, stored.get(path)),
        collection: (name) => ({ doc: (id) => storeDoc(`${path}/${name}/${id}`) }),
    });
    const db = {
        reads, facilities, stored,
        collection: (name) => {
            if (name === 'healthFacilities') {
                return {
                    get: async () => { reads.full += 1; return { docs: [...facilities].map(([id, d]) => docSnap(id, d)) }; },
                    where: (field, op, value) => ({
                        get: async () => {
                            reads.delta += 1;
                            return { docs: [...facilities].filter(([, d]) => (d.lastSnapshotAt?.toMillis?.() || 0) > value.ms).map(([id, d]) => docSnap(id, d)) };
                        },
                    }),
                    count: () => ({ get: async () => { reads.count += 1; return { data: () => ({ count: facilities.size }) }; } }),
                };
            }
            return { doc: (id) => storeDoc(`${name}/${id}`) };
        },
        batch: () => {
            const ops = [];
            return {
                set: (ref, data) => ops.push(() => stored.set(ref.path, data)),
                delete: (ref) => ops.push(() => stored.delete(ref.path)),
                commit: async () => ops.forEach((op) => op()),
            };
        },
    };
    return db;
}

const facility = (name, at, extra = {}) => ({
    'اسم_المؤسسة': name, 'الولاية': 'Khartoum', 'المحلية': 'Bahri', 'هل_المؤسسة_تعمل': 'Yes',
    lastSnapshotAt: ts(at), imnci_staff: [{ name: 'A', phone: '0912' }], neonatal_phototherapy: 2,
    signature_url: 'data:image/png;base64,AAAA', ...extra,
});

describe('slim facility', () => {
    it('drops staff lists, signatures and notes, keeps the rest, turns timestamps into milliseconds', () => {
        const s = slimFacility('f1', facility('Clinic', 1000, { hdu_bed_capacity_notes: 'long text', etat_has_service: 'Yes', neonatal_level_of_care: { secondary: true } }));
        expect(s).toMatchObject({ id: 'f1', 'اسم_المؤسسة': 'Clinic', neonatal_phototherapy: 2, etat_has_service: 'Yes', lastSnapshotAt: 1000, neonatal_level_of_care: { secondary: true } });
        expect(s).not.toHaveProperty('imnci_staff');
        expect(s).not.toHaveProperty('signature_url');
        expect(s).not.toHaveProperty('hdu_bed_capacity_notes');
    });

    it('never drops a field the dashboards or the main-menu coverage name', () => {
        const files = ['src/components/ServiceCoverageDashboard.jsx', 'src/utils/homeStats.js', 'src/utils/coverageEligibility.js'];
        const names = new Set();
        files.forEach((f) => {
            const src = readFileSync(path.resolve(process.cwd(), f), "utf8");
            for (const m of src.matchAll(/['"]([A-Za-z_؀-ۿ][A-Za-z0-9_؀-ۿ]{1,60})['"]/g)) names.add(m[1]);
            for (const m of src.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)/g)) names.add(m[1]);
        });
        // Words that are not facility fields (translation keys of the Copy button).
        const notFields = new Set(['copy_image']);
        const dropped = [...names].filter((n) => !notFields.has(n) && DROP_KEY.test(n));
        expect(dropped).toEqual([]);
    });
});

describe('dashboard copy', () => {
    it('builds once, then reads only what changed', async () => {
        let now = 1_000_000;
        const db = fakeDb({ a: facility('A', 900_000), b: facility('B', 950_000) });
        const core = makeCore({ db, Timestamp, now: () => now });

        const first = await core.answer(null);
        expect(first.items.map((f) => f.id).sort()).toEqual(['a', 'b']);
        expect(db.reads.full).toBe(1);

        // Same version: nothing is sent again.
        now += 1000;
        const same = await core.answer(first.version);
        expect(same).toEqual({ unchanged: true, version: first.version });
        expect(db.reads.full).toBe(1);
        expect(db.reads.delta).toBe(1);

        // A facility is saved: only it is re-read, and the version moves.
        db.facilities.set('a', facility('A renamed', 1_001_000));
        now += 1000;
        const changed = await core.answer(first.version);
        expect(changed.version).not.toBe(first.version);
        expect(changed.items.find((f) => f.id === 'a')['اسم_المؤسسة']).toBe('A renamed');
        expect(db.reads.full).toBe(1);
    });

    it('rebuilds in full when a facility was deleted, and once a day', async () => {
        let now = 1_000_000;
        const db = fakeDb({ a: facility('A', 900_000), b: facility('B', 950_000) });
        const core = makeCore({ db, Timestamp, now: () => now });
        await core.answer(null);

        db.facilities.delete('b');
        now += 1000;
        const afterDelete = await core.answer(null);
        expect(afterDelete.items.map((f) => f.id)).toEqual(['a']);
        expect(db.reads.full).toBe(2);

        now += FULL_REBUILD_MS + 1;
        await core.answer(null);
        expect(db.reads.full).toBe(3);
    });

    it('a new instance restores the saved copy instead of reading every facility', async () => {
        const db = fakeDb({ a: facility('A', 900_000), b: facility('B', 950_000) });
        const first = await makeCore({ db, Timestamp, now: () => 1_000_000 }).answer(null);
        expect(db.reads.full).toBe(1);

        const restored = await makeCore({ db, Timestamp, now: () => 1_001_000 }).answer(null);
        expect(db.reads.full).toBe(1);
        expect(restored.items).toEqual(first.items);
    });

    it('splits a large copy into parts under the document size limit', async () => {
        const many = {};
        for (let i = 0; i < 1500; i += 1) many[`f${i}`] = facility(`مستشفى ${'أ'.repeat(200)} ${i}`, 900_000 + i);
        const db = fakeDb(many);
        await makeCore({ db, Timestamp, now: () => 1_000_000 }).answer(null);
        const meta = db.stored.get('_dashboardCopies/facilities');
        expect(meta.parts).toBeGreaterThan(1);
        for (let i = 0; i < meta.parts; i += 1) {
            const text = db.stored.get(`_dashboardCopies/facilities/parts/${i}`).text;
            expect(Buffer.byteLength(text, 'utf8')).toBeLessThan(1_000_000);
        }
    });
});
