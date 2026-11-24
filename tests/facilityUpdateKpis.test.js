// Facility update numbers (src/dashboards/facilityUpdate.js) must equal what
// UpdateDashboard worked out before (tests/fixtures/updateDashboardOriginal.js,
// the page's code unchanged), and the server must give the same numbers.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { updateRecord, updateCounts, updateDashboardData, yearMonthOf } from '../src/dashboards/facilityUpdate';
import { originalDashboardData } from './fixtures/updateDashboardOriginal';

const require = createRequire(import.meta.url);
const { makeDashboardKpis } = require('../functions/dashboardKpisCore.js');

let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rand() * a.length)];
const DAY = 86400000;
const NOW = Date.now();
const STATES = ['Khartoum', 'Gezira', 'Kassala'];
const LOCS = { Khartoum: ['Bahri', 'Omdurman'], Gezira: ['Wad Madani'], Kassala: ['Kassala', 'Halfa'] };
const PEOPLE = ['Amna (amna@x.org)', 'amna@x.org', 'Cleaned by Omar (omar@x.org)', 'omar@x.org', 'System', 'unknown', 'sara@x.org', 'Sara', undefined];
const ts = (ms) => ({ toDate: () => new Date(ms), toMillis: () => ms, seconds: Math.floor(ms / 1000) });
const facilities = [];
for (let i = 0; i < 400; i += 1) {
    const st = pick(STATES);
    const created = NOW - Math.floor(rand() * 800) * DAY;
    const updated = created + Math.floor(rand() * 400) * DAY * (rand() < 0.2 ? 0 : 1) + (rand() < 0.1 ? 5000 : 0);
    facilities.push({
        id: `f${i}`, 'الولاية': rand() < 0.03 ? undefined : st, 'المحلية': pick(LOCS[st]),
        createdAt: rand() < 0.1 ? undefined : ts(created),
        lastSnapshotAt: rand() < 0.05 ? undefined : ts(Math.min(updated, NOW)),
        revision: rand() < 0.1 ? 3 : undefined,
        history: rand() < 0.1 ? [{}] : undefined,
        updated_by: pick(PEOPLE),
        'وجود_العلاج_المتكامل_لامراض_الطفولة': pick(['Yes', '', null, 'No']),
        eenc_provides_essential_care: pick(['Yes', undefined]),
        neonatal_level_of_care: rand() < 0.2 ? { primary: true } : undefined,
        neonatal_level_secondary: pick([undefined, 'Yes']),
        etat_has_service: pick(['', 'No', undefined]),
    });
}
const FILTERS = [];
['', 'Khartoum', 'Kassala'].forEach((s) => ['', 'Bahri', 'Halfa'].forEach((l) => ['THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'LAST_YEAR', 'ALL_TIME'].forEach((tf) => FILTERS.push([s, l, tf]))));

describe('facility update numbers', () => {
    it('match the original page for every filter and period', () => {
        const cells = updateCounts(facilities.map(updateRecord));
        const now = yearMonthOf(Date.now());
        FILTERS.forEach(([s, l, tf]) => {
            expect(updateDashboardData(cells, { stateFilter: s, localityFilter: l, timeFilter: tf, now })).toEqual(originalDashboardData(facilities, s, l, tf));
        });
    });

    it('the server gives the same numbers', async () => {
        const docs = (map) => Array.from(map.entries()).map(([id, d]) => ({ id, data: () => d }));
        const data = { healthFacilities: new Map(facilities.map((f) => [f.id, { ...f, lastSnapshotAt: f.lastSnapshotAt || ts(0) }])) };
        const store = new Map();
        const storeDoc = (p) => ({ get: async () => ({ exists: store.has(p), data: () => store.get(p) }), collection: (n) => ({ doc: (id) => storeDoc(`${p}/${n}/${id}`) }), path: p });
        const db = {
            collection: (name) => {
                if (name === '_dashboardCopies') return { doc: (id) => storeDoc(id) };
                const map = data[name] || new Map();
                return {
                    get: async () => ({ size: map.size, docs: docs(map) }),
                    where: (_f, _op, since) => ({ get: async () => { const d = docs(map).filter((x) => x.data().lastSnapshotAt.toMillis() > since.ms); return { size: d.length, docs: d }; } }),
                    count: () => ({ get: async () => ({ data: () => ({ count: map.size }) }) }),
                };
            },
            batch: () => { const ops = []; return { set: (ref, v) => ops.push([ref.path, v]), delete: () => {}, commit: async () => ops.forEach(([p, v]) => store.set(p, v)) }; },
        };
        // The page's own original numbers use the device's time zone; ask the
        // server for the same zone so the two can be compared.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const kpis = makeDashboardKpis({ db, Timestamp: { fromMillis: (ms) => ({ ms }) } });
        const res = await kpis.answer({ dashboard: 'facilityUpdate', scope: { level: 'federal' }, timeZone: tz });
        const now = yearMonthOf(Date.now(), tz);
        // The page fills missing lastSnapshotAt from 'اخر تحديث'/updatedAt; the
        // fixture's copy here sets 0 for those, so compare with the same input.
        const sameInput = facilities.map((f) => ({ ...f, lastSnapshotAt: f.lastSnapshotAt || ts(0) }));
        FILTERS.forEach(([s, l, tf]) => {
            expect(updateDashboardData(res.cells, { stateFilter: s, localityFilter: l, timeFilter: tf, now })).toEqual(originalDashboardData(sameInput, s, l, tf));
        });
        const scoped = await kpis.answer({ dashboard: 'facilityUpdate', scope: { level: 'state', states: ['Kassala'] }, timeZone: tz });
        expect(scoped.cells.every((c) => c.state === 'Kassala')).toBe(true);
        expect(updateDashboardData(scoped.cells, { timeFilter: 'ALL_TIME', now })).toEqual(originalDashboardData(sameInput.filter((f) => f['الولاية'] === 'Kassala'), '', '', 'ALL_TIME'));
    });
});
