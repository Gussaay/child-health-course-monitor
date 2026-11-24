// src/dashboards/facilityHistory.js
//
// The facility history dashboard (FacilityHistoryView.jsx,
// AggregateHistoryDashboard): service coverage at past dates, from the latest
// snapshot of each facility on or before each date.
//
// Shared by the page (its fallback path, reading the snapshots itself) and
// the server (functions/dashboardKpis.js, through the generated bundle), so
// both give the same numbers. See docs/server-dashboard-kpis.md.
//
// The numbers are kept as COUNTS per state and locality (facilities in
// scope, facilities offering the service, facilities with each tool). Counts
// add up, so any choice of state and locality is a sum, and the percentages
// are then worked out from the totals exactly as the page always has.

const normalizeStr = (str) => (typeof str === 'string' ? str.trim() : str);

export const HISTORY_SERVICES = {
    imnci: {
        inScope: (f) => ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(normalizeStr(f['نوع_المؤسسةالصحية'])) && f['هل_المؤسسة_تعمل'] === 'Yes',
        provides: (f) => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes',
        tools: [
            { key: 'وجود_سجل_علاج_متكامل', label: 'IMNCI Register' },
            { key: 'وجود_كتيب_لوحات', label: 'Chart Booklet' },
            { key: 'ميزان_وزن', label: 'Weight Scale' },
            { key: 'ساعة_مؤقت', label: 'Timer' },
        ],
    },
    eenc: {
        inScope: (f) => ['BEmONC', 'CEmONC'].includes(normalizeStr(f.eenc_service_type)) && f['هل_المؤسسة_تعمل'] === 'Yes',
        provides: (f) => f.eenc_provides_essential_care === 'Yes',
        tools: [
            { key: 'eenc_steam_sterilizer', label: 'Steam Sterilizer' },
            { key: 'eenc_wall_clock', label: 'Wall Clock' },
        ],
    },
    neonatal: {
        inScope: (f) => ['CEmONC', 'pediatric'].includes(normalizeStr(f.eenc_service_type)) || f.neonatal_level_secondary === 'Yes' || f.neonatal_level_tertiary === 'Yes' || f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary,
        provides: (f) => f.neonatal_level_secondary === 'Yes' || f.neonatal_level_of_care?.secondary === true || f.neonatal_level_tertiary === 'Yes' || f.neonatal_level_of_care?.tertiary === true,
        tools: [
            { key: 'neonatal_kmc_unit', label: 'KMC Unit' },
            { key: 'neonatal_breastfeeding_unit', label: 'Breastfeeding Unit' },
        ],
    },
    critical: {
        inScope: (f) => ['مستشفى', 'مستشفى ريفي'].includes(normalizeStr(f['نوع_المؤسسةالصحية'])) || normalizeStr(f.eenc_service_type) === 'pediatric',
        provides: (f) => f.etat_has_service === 'Yes',
        tools: [
            { key: 'hdu_has_service', label: 'HDU Service' },
            { key: 'picu_has_service', label: 'PICU Service' },
        ],
    },
};

// Fields the history needs from a facility or snapshot (the server keeps
// only these, so its copy of the snapshots stays small).
export const HISTORY_FIELDS = Array.from(new Set([
    'facilityId', 'effectiveDate', 'الولاية', 'المحلية', 'نوع_المؤسسةالصحية', 'هل_المؤسسة_تعمل',
    'وجود_العلاج_المتكامل_لامراض_الطفولة', 'eenc_service_type', 'eenc_provides_essential_care',
    'neonatal_level_primary', 'neonatal_level_secondary', 'neonatal_level_tertiary', 'neonatal_level_of_care',
    'etat_has_service', 'hdu_has_service', 'picu_has_service',
    ...Object.values(HISTORY_SERVICES).flatMap((s) => s.tools.map((t) => t.key)),
]));

// The facility as it was before its first snapshot (data.js used the same).
const NO_SERVICES = {
    'وجود_العلاج_المتكامل_لامراض_الطفولة': 'No',
    'eenc_provides_essential_care': 'No',
    'etat_has_service': 'No',
    'hdu_has_service': 'No',
    'picu_has_service': 'No',
    'neonatal_level_primary': 'No',
    'neonatal_level_secondary': 'No',
    'neonatal_level_tertiary': 'No',
};

/** Milliseconds of a Firestore Timestamp, { seconds } object, number or date string. */
export function timeOf(v) {
    if (!v) return 0;
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v === 'object' && typeof v._seconds === 'number') return v._seconds * 1000;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Every current facility of `states` as it was at `targetMs`: its latest
 * snapshot on or before that time, or, with no snapshot yet, the facility with
 * every service marked No. (data.js fetchFacilitiesHistoryMultiDate.)
 *   snapshots   [{ facilityId, effectiveDate, الولاية, ... }]
 *   facilities  [[id, data]] or Map of the current facilities of those states
 */
export function facilitiesAt(snapshots, facilities, states, targetMs) {
    const stateSet = new Set(states);
    const latest = new Map();
    (snapshots || []).forEach((snap) => {
        if (!stateSet.has(snap['الولاية'])) return;
        const t = timeOf(snap.effectiveDate);
        if (t > targetMs) return;
        const prev = latest.get(snap.facilityId);
        if (!prev || t > prev._time) latest.set(snap.facilityId, { ...snap, _time: t });
    });
    const out = [];
    const entries = facilities instanceof Map ? facilities.entries() : facilities;
    for (const [facilityId, current] of entries) {
        out.push(latest.has(facilityId) ? latest.get(facilityId) : { ...current, facilityId, ...NO_SERVICES });
    }
    return out;
}

const emptyServiceCount = (service) => ({ base: 0, providers: 0, tools: Object.fromEntries(service.tools.map((t) => [t.key, 0])) });

/**
 * Counts for one date: { [state]: { [locality]: { imnci, eenc, neonatal,
 * critical } } }, each { base, providers, tools: { key: n } }.
 */
export function historyCounts(facilities) {
    const out = {};
    (facilities || []).forEach((f) => {
        const st = f['الولاية'] || '';
        const loc = f['المحلية'] || '';
        Object.entries(HISTORY_SERVICES).forEach(([key, service]) => {
            if (!service.inScope(f)) return;
            if (!out[st]) out[st] = {};
            if (!out[st][loc]) out[st][loc] = {};
            if (!out[st][loc][key]) out[st][loc][key] = emptyServiceCount(service);
            const c = out[st][loc][key];
            c.base += 1;
            if (service.provides(f)) {
                c.providers += 1;
                service.tools.forEach((tool) => { if (f[tool.key] === 'Yes') c.tools[tool.key] += 1; });
            }
        });
    });
    return out;
}

/**
 * The page's numbers for one date from its counts, for the states asked and
 * (optionally) one locality: { imnci: { total: { num, perc, base }, tools:
 * { key: { num, perc } } }, ... } exactly as AggregateHistoryDashboard shows.
 */
export function historyMetrics(counts, { states = null, locality = '' } = {}) {
    const out = {};
    Object.entries(HISTORY_SERVICES).forEach(([key, service]) => {
        const sum = emptyServiceCount(service);
        Object.entries(counts || {}).forEach(([st, byLoc]) => {
            if (states && !states.includes(st)) return;
            Object.entries(byLoc).forEach(([loc, byService]) => {
                if (locality && loc !== locality) return;
                const c = byService[key];
                if (!c) return;
                sum.base += c.base; sum.providers += c.providers;
                service.tools.forEach((tool) => { sum.tools[tool.key] += c.tools[tool.key] || 0; });
            });
        });
        if (sum.base === 0) {
            out[key] = { total: { num: 0, perc: 0, base: 0 }, tools: Object.fromEntries(service.tools.map((t) => [t.key, { num: 0, perc: 0 }])) };
            return;
        }
        out[key] = {
            total: { num: sum.providers, perc: Math.round((sum.providers / sum.base) * 100), base: sum.base },
            tools: Object.fromEntries(service.tools.map((t) => [t.key, { num: sum.tools[t.key], perc: Math.round((sum.tools[t.key] / Math.max(sum.providers, 1)) * 100) }])),
        };
    });
    return out;
}
