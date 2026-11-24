// src/dashboards/facilityUpdate.js
//
// The facility update dashboard (UpdateDashboard.jsx): how many facilities
// were updated, by state, locality and person, in a period. Shared by the
// page and the server (docs/server-dashboard-kpis.md).
//
// Each facility becomes a small record (updateRecord); records become counts
// per (month, state, locality, person) cell (updateCounts); the page's
// numbers come from the cells (updateDashboardData). Cells keep the order in
// which they were first seen, so "top" ties resolve exactly as before.

const getValidDate = (val) => {
    if (!val) return null;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    if (typeof val === 'object' && val !== null) {
        if ('seconds' in val) return new Date(val.seconds * 1000);
        if ('_seconds' in val) return new Date(val._seconds * 1000);
    }
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
};
const getUpdateDate = (f) => getValidDate(f.lastSnapshotAt) || getValidDate(f['اخر تحديث']) || getValidDate(f.updatedAt);
const getCreationDate = (f) => getValidDate(f.createdAt) || getValidDate(f.created_at);

const isUpdatedAfterCreation = (f) => {
    if (f.revision && f.revision > 1) return true;
    if (Array.isArray(f.history) && f.history.length > 0) return true;
    if (typeof f.updated_by === 'string' && f.updated_by.toLowerCase().includes('cleaned by')) return true;
    const uDate = getUpdateDate(f);
    const cDate = getCreationDate(f);
    const updatedMs = uDate ? uDate.getTime() : 0;
    const createdMs = cDate ? cDate.getTime() : 0;
    if (createdMs > 0 && updatedMs > 0) return (updatedMs - createdMs) > 10000;
    if (createdMs === 0 && updatedMs > 0) return true;
    return false;
};

export const UPDATE_SERVICES = ['IMNCI', 'EENC', 'Neonatal', 'ETAT'];
const hasServiceData = (f, service) => {
    switch (service) {
        case 'IMNCI': return f['وجود_العلاج_المتكامل_لامراض_الطفولة'] != null && f['وجود_العلاج_المتكامل_لامراض_الطفولة'] !== '';
        case 'EENC': return f.eenc_provides_essential_care != null && f.eenc_provides_essential_care !== '';
        case 'Neonatal': return (f.neonatal_level_of_care && Object.keys(f.neonatal_level_of_care).length > 0) || f.neonatal_level_primary != null || f.neonatal_level_secondary != null || f.neonatal_level_tertiary != null;
        case 'ETAT': return f.etat_has_service != null && f.etat_has_service !== '';
        default: return false;
    }
};

/** The few things the dashboard needs from one facility. */
export function updateRecord(f) {
    const updated = getUpdateDate(f);
    return {
        state: f['الولاية'],
        locality: f['المحلية'],
        updatedMs: updated ? updated.getTime() : null,
        isUpdate: isUpdatedAfterCreation(f),
        updatedBy: typeof f.updated_by === 'string' ? f.updated_by : (f.updated_by || null),
        services: UPDATE_SERVICES.filter((s) => hasServiceData(f, s)),
    };
}

// --- Updater names (as UpdateDashboard.jsx) ---
const buildEmailToNameMap = (records) => {
    const map = {};
    records.forEach((r) => {
        const raw = r.updatedBy;
        if (!raw || typeof raw !== 'string') return;
        const cleaned = raw.replace(/^Cleaned by\s+/i, '').trim();
        const match = cleaned.match(/^(.*?)\s*\((.*?@.*?)\)$/);
        if (match) {
            const name = match[1].trim();
            const email = match[2].trim().toLowerCase();
            if (name && email) map[email] = name;
        }
    });
    return map;
};
const normalizeUpdater = (raw, emailMap) => {
    if (!raw) return 'System / Unknown';
    const s = String(raw).replace(/^Cleaned by\s+/i, '').trim();
    const lower = s.toLowerCase();
    if (lower === 'system' || lower === 'unknown uploader' || lower === 'unknown / system' || lower === 'unknown') return 'System / Unknown';
    const match = s.match(/^(.*?)\s*\((.*?@.*?)\)$/);
    if (match) return match[1].trim();
    if (s.includes('@')) {
        const email = s.trim().toLowerCase();
        if (emailMap[email]) return emailMap[email];
        return email.split('@')[0];
    }
    return s;
};

/** { year, month } of a time, in `timeZone` (IANA name) or the device's own time. */
export function yearMonthOf(ms, timeZone) {
    if (!timeZone) {
        const d = new Date(ms);
        return { year: d.getFullYear(), month: d.getMonth() };
    }
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric' }).formatToParts(new Date(ms));
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    return { year: get('year'), month: get('month') - 1 };
}

/**
 * Counts per (year, month, state, locality, person), in the order first seen:
 * [{ year, month, state, locality, updater, total, IMNCI, EENC, Neonatal, ETAT }].
 * `records` are every facility of the viewer's scope (updateRecord each).
 */
export function updateCounts(records, { timeZone } = {}) {
    const emailMap = buildEmailToNameMap(records);
    const cells = [];
    const index = new Map();
    records.forEach((r) => {
        if (!r.isUpdate || r.updatedMs == null) return;
        const { year, month } = yearMonthOf(r.updatedMs, timeZone);
        const updater = normalizeUpdater(r.updatedBy, emailMap);
        const key = `${year}|${month}|${r.state}|${r.locality}|${updater}`;
        let c = index.get(key);
        if (!c) {
            c = { year, month, state: r.state, locality: r.locality, updater, total: 0, IMNCI: 0, EENC: 0, Neonatal: 0, ETAT: 0 };
            index.set(key, c);
            cells.push(c);
        }
        c.total += 1;
        r.services.forEach((s) => { c[s] += 1; });
    });
    return cells;
}

/**
 * The page's numbers (UpdateDashboard's dashboardData) from the cells.
 *   now  { year, month } of "now" in the same time zone as the cells
 */
export function updateDashboardData(cells, { stateFilter = '', localityFilter = '', timeFilter = 'THIS_MONTH', now }) {
    if (!cells) return null;
    const { year: currentYear, month: currentMonth } = now;
    const inPeriod = (c) => {
        if (timeFilter === 'THIS_MONTH') return c.month === currentMonth && c.year === currentYear;
        if (timeFilter === 'LAST_MONTH') {
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            return c.month === lastMonth && c.year === lastMonthYear;
        }
        if (timeFilter === 'THIS_YEAR') return c.year === currentYear;
        if (timeFilter === 'LAST_YEAR') return c.year === currentYear - 1;
        return true;
    };
    let updatedThisMonth = 0;
    const stateStats = {};
    const localityStats = {};
    const updaterStats = {};
    cells.forEach((c) => {
        if (stateFilter && c.state !== stateFilter) return;
        if (localityFilter && c.locality !== localityFilter) return;
        if (!inPeriod(c)) return;
        if (c.month === currentMonth && c.year === currentYear) updatedThisMonth += c.total;
        const stateKey = c.state || 'Unknown';
        if (!stateStats[stateKey]) stateStats[stateKey] = { total: 0, IMNCI: 0, EENC: 0, Neonatal: 0, ETAT: 0 };
        const locKey = c.locality || 'Unknown';
        if (!localityStats[locKey]) localityStats[locKey] = { total: 0 };
        if (!updaterStats[c.updater]) updaterStats[c.updater] = { total: 0, IMNCI: 0, EENC: 0, Neonatal: 0, ETAT: 0 };
        stateStats[stateKey].total += c.total;
        localityStats[locKey].total += c.total;
        updaterStats[c.updater].total += c.total;
        UPDATE_SERVICES.forEach((s) => { stateStats[stateKey][s] += c[s]; updaterStats[c.updater][s] += c[s]; });
    });
    const top = (o) => Object.entries(o).sort((a, b) => b[1].total - a[1].total)[0];
    return { updatedThisMonth, stateStats, updaterStats, topState: top(stateStats), topLocality: top(localityStats), topUpdater: top(updaterStats) };
}
