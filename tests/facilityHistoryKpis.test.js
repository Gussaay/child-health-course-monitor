// Facility history numbers (src/dashboards/facilityHistory.js) must equal what
// the page worked out before (AggregateHistoryDashboard's processService and
// data.js fetchFacilitiesHistoryMultiDate, copied below unchanged), and the
// server (functions/dashboardKpisCore.js) must give the same numbers.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { facilitiesAt, historyCounts, historyMetrics } from '../src/dashboards/facilityHistory';

const require = createRequire(import.meta.url);
const { makeDashboardKpis } = require('../functions/dashboardKpisCore.js');

// ---- The original code, as it was in the page and data.js ----
const normalizeStr = (str) => typeof str === 'string' ? str.trim() : str;
function originalMetrics(dayFacilities, selectedLocality) {
    const processService = (facilities, serviceCheckFn, toolKeys) => {
        let filtered = facilities;
        if (selectedLocality) filtered = filtered.filter(f => f['المحلية'] === selectedLocality);
        const baseDenominator = filtered.length;
        if (baseDenominator === 0) return { total: { num: 0, perc: 0, base: 0 }, tools: toolKeys.reduce((acc, k) => ({...acc, [k.key]: { num: 0, perc: 0 }}), {}) };
        const serviceProviders = filtered.filter(serviceCheckFn);
        const toolsAgg = toolKeys.reduce((acc, k) => {
            const count = serviceProviders.filter(f => f[k.key] === 'Yes').length;
            acc[k.key] = { num: count, perc: Math.round((count / Math.max(serviceProviders.length, 1)) * 100) };
            return acc;
        }, {});
        return { total: { num: serviceProviders.length, perc: Math.round((serviceProviders.length / baseDenominator) * 100), base: baseDenominator }, tools: toolsAgg };
    };
    return {
        imnci: processService(dayFacilities.filter(f => ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(normalizeStr(f['نوع_المؤسسةالصحية'])) && f['هل_المؤسسة_تعمل'] === 'Yes'), f => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes', [ { key: 'وجود_سجل_علاج_متكامل' }, { key: 'وجود_كتيب_لوحات' }, { key: 'ميزان_وزن' }, { key: 'ساعة_مؤقت' } ]),
        eenc: processService(dayFacilities.filter(f => ['BEmONC', 'CEmONC'].includes(normalizeStr(f.eenc_service_type)) && f['هل_المؤسسة_تعمل'] === 'Yes'), f => f.eenc_provides_essential_care === 'Yes', [ { key: 'eenc_steam_sterilizer' }, { key: 'eenc_wall_clock' } ]),
        neonatal: processService(dayFacilities.filter(f => ['CEmONC', 'pediatric'].includes(normalizeStr(f.eenc_service_type)) || f.neonatal_level_secondary === 'Yes' || f.neonatal_level_tertiary === 'Yes' || f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary), f => f.neonatal_level_secondary === 'Yes' || f.neonatal_level_of_care?.secondary === true || f.neonatal_level_tertiary === 'Yes' || f.neonatal_level_of_care?.tertiary === true, [ { key: 'neonatal_kmc_unit' }, { key: 'neonatal_breastfeeding_unit' } ]),
        critical: processService(dayFacilities.filter(f => ['مستشفى', 'مستشفى ريفي'].includes(normalizeStr(f['نوع_المؤسسةالصحية'])) || normalizeStr(f.eenc_service_type) === 'pediatric'), f => f.etat_has_service === 'Yes', [ { key: 'hdu_has_service' }, { key: 'picu_has_service' } ]),
    };
}
function originalFacilitiesAt(globalSnapshotCache, currentFacilitiesMap, states, targetDate) {
    const validSnapshots = globalSnapshotCache.filter(snap => {
        if (!states.includes(snap['الولاية'])) return false;
        const snapDate = snap.effectiveDate?.toDate ? snap.effectiveDate.toDate() : new Date(0);
        return snapDate <= targetDate;
    });
    const latestSnapshotsMap = new Map();
    validSnapshots.forEach(snap => {
        const facilityId = snap.facilityId;
        const snapDate = snap.effectiveDate?.toDate ? snap.effectiveDate.toDate().getTime() : 0;
        if (!latestSnapshotsMap.has(facilityId)) latestSnapshotsMap.set(facilityId, { ...snap, _time: snapDate });
        else if (snapDate > latestSnapshotsMap.get(facilityId)._time) latestSnapshotsMap.set(facilityId, { ...snap, _time: snapDate });
    });
    const historicalState = [];
    currentFacilitiesMap.forEach((currentData, facilityId) => {
        if (latestSnapshotsMap.has(facilityId)) historicalState.push(latestSnapshotsMap.get(facilityId));
        else historicalState.push({ ...currentData, facilityId, 'وجود_العلاج_المتكامل_لامراض_الطفولة': 'No', 'eenc_provides_essential_care': 'No', 'etat_has_service': 'No', 'hdu_has_service': 'No', 'picu_has_service': 'No', 'neonatal_level_primary': 'No', 'neonatal_level_secondary': 'No', 'neonatal_level_tertiary': 'No' });
    });
    return historicalState;
}

// ---- Fixture: random facilities and snapshots, fixed seed ----
let seed = 42;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rand() * a.length)];
const yn = () => pick(['Yes', 'No', 'Yes', undefined]);
const STATES = ['Khartoum', 'Gezira', 'Kassala'];
const LOCS = { Khartoum: ['Bahri', 'Omdurman'], Gezira: ['Wad Madani', 'Hasaheisa'], Kassala: ['Kassala'] };
const facilityData = (st) => ({
    'الولاية': st, 'المحلية': pick(LOCS[st]),
    'نوع_المؤسسةالصحية': pick(['وحدة صحة الاسرة', 'مركز صحة الاسرة ', 'مستشفى', 'مستشفى ريفي', 'other']),
    'هل_المؤسسة_تعمل': pick(['Yes', 'Yes', 'No']),
    'وجود_العلاج_المتكامل_لامراض_الطفولة': yn(), 'وجود_سجل_علاج_متكامل': yn(), 'وجود_كتيب_لوحات': yn(), 'ميزان_وزن': yn(), 'ساعة_مؤقت': yn(),
    eenc_service_type: pick(['BEmONC', 'CEmONC', 'pediatric', ' CEmONC', undefined]), eenc_provides_essential_care: yn(), eenc_steam_sterilizer: yn(), eenc_wall_clock: yn(),
    neonatal_level_secondary: yn(), neonatal_level_tertiary: yn(), neonatal_level_of_care: rand() < 0.2 ? { secondary: rand() < 0.5, tertiary: rand() < 0.3 } : undefined,
    neonatal_kmc_unit: yn(), neonatal_breastfeeding_unit: yn(), etat_has_service: yn(), hdu_has_service: yn(), picu_has_service: yn(),
});
const DAY = 86400000;
const T0 = Date.UTC(2026, 0, 1);
const facilities = new Map();
for (let i = 0; i < 300; i += 1) { const st = pick(STATES); facilities.set(`f${i}`, facilityData(st)); }
const snapshots = [];
facilities.forEach((f, id) => {
    const n = Math.floor(rand() * 4);
    for (let k = 0; k < n; k += 1) {
        const ms = T0 + Math.floor(rand() * 300) * DAY;
        snapshots.push({ id: `${id}_${k}`, facilityId: id, ...facilityData(f['الولاية']), 'الولاية': f['الولاية'], effectiveDate: { toDate: () => new Date(ms), toMillis: () => ms }, snapshotCreatedAt: { toMillis: () => ms + 1000 } });
    }
});
const DATES = [T0 + 30 * DAY, T0 + 120 * DAY, T0 + 299 * DAY + 0.5 * DAY].map((ms) => new Date(ms));

describe('facility history numbers', () => {
    const cases = [
        { states: STATES, locality: '' },
        { states: ['Khartoum'], locality: '' },
        { states: ['Khartoum'], locality: 'Bahri' },
        { states: ['Gezira', 'Kassala'], locality: 'Hasaheisa' },
    ];
    it.each(cases)('match the original page for %o', ({ states, locality }) => {
        const currentMap = new Map([...facilities].filter(([, f]) => states.includes(f['الولاية'])));
        DATES.forEach((d) => {
            const before = originalMetrics(originalFacilitiesAt(snapshots, currentMap, states, d), locality);
            const day = facilitiesAt(snapshots, currentMap, states, d.getTime());
            expect(historyMetrics(historyCounts(day), { locality })).toEqual(before);
            // Counts for all states, narrowed afterwards, give the same numbers.
            const allMap = new Map(facilities);
            const allCounts = historyCounts(facilitiesAt(snapshots, allMap, STATES, d.getTime()));
            expect(historyMetrics(allCounts, { states, locality })).toEqual(before);
        });
    });

    it('the server gives the same numbers', async () => {
        const docs = (map) => Array.from(map.entries()).map(([id, d]) => ({ id, data: () => d }));
        const data = {
            healthFacilities: new Map([...facilities].map(([id, f]) => [id, { ...f, lastSnapshotAt: { toMillis: () => T0 } }])),
            facilitySnapshots: new Map(snapshots.map((s) => [s.id, s])),
        };
        const markOf = (name, d) => (name === 'facilitySnapshots' ? d.snapshotCreatedAt : d.lastSnapshotAt).toMillis();
        const store = new Map();
        const storeDoc = (p) => ({ get: async () => ({ exists: store.has(p), data: () => store.get(p) }), collection: (n) => ({ doc: (id) => storeDoc(`${p}/${n}/${id}`) }), path: p });
        const db = {
            collection: (name) => {
                if (name === '_dashboardCopies') return { doc: (id) => storeDoc(id) };
                const map = data[name];
                return {
                    get: async () => ({ size: map.size, docs: docs(map) }),
                    where: (_f, _op, since) => ({ get: async () => { const d = docs(map).filter((x) => markOf(name, x.data()) > since.ms); return { size: d.length, docs: d }; } }),
                    count: () => ({ get: async () => ({ data: () => ({ count: map.size }) }) }),
                };
            },
            batch: () => { const ops = []; return { set: (ref, v) => ops.push([ref.path, v]), delete: () => {}, commit: async () => ops.forEach(([p, v]) => store.set(p, v)) }; },
        };
        const kpis = makeDashboardKpis({ db, Timestamp: { fromMillis: (ms) => ({ ms }) }, now: () => T0 + 400 * DAY });
        for (const { states, locality } of cases) {
            const res = await kpis.answer({ dashboard: 'facilityHistory', states, dates: DATES.map((d) => d.toISOString()) });
            const currentMap = new Map([...facilities].filter(([, f]) => states.includes(f['الولاية'])));
            res.results.forEach((r, i) => {
                const before = originalMetrics(originalFacilitiesAt(snapshots, currentMap, states, DATES[i]), locality);
                expect(historyMetrics(r.counts, { states, locality })).toEqual(before);
            });
        }
        expect(JSON.stringify(await kpis.answer({ dashboard: 'facilityHistory', states: ['Khartoum'], dates: [DATES[0].toISOString()] }))).not.toMatch(/staff/);
        expect(await kpis.answer({ dashboard: 'nope' })).toEqual({ error: 'unknown dashboard' });
    });
});
