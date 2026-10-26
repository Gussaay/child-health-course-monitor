// src/utils/aiActivity.js
//
// Who used the AI features, for what, and how much of their own daily limit
// and of the shared free-tier pool: the super users' AI activity tab
// (components/AiActivityTab.jsx). The functions write one aiLog record per use
// (functions/aiLog.js): { uid, email, name, feature, what, where, model,
// status, used, limit, pool, day, at, vote? } (vote: 1 = 👍, -1 = 👎).
//
// A use counts against the limits when it reached the AI ("ok" or "error";
// the function counts before it calls). A saved answer handed out again
// ("cached") and a refusal over the limit ("limit") do not.

export const FEATURE_LABELS = {
    assistant: 'Ask the data',
    'library:ask': 'Library: ask a book',
    'library:summary': 'Library: book summary',
    'library:sectionSummary': 'Course section AI',
    'library:tidySection': 'AI book import',
};

export const featureLabel = (f) => FEATURE_LABELS[f] || f || 'Other';

// The functions' daily limits count per feature group, not per task.
const limitGroup = (f) => (String(f).startsWith('library:') ? 'library' : f);

const counts = (l) => l.status === 'ok' || l.status === 'error';
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
const ms = (at) => (typeof at?.toMillis === 'function' ? at.toMillis() : Number(at?.seconds) * 1000 || Number(at) || 0);

/** YYYY-MM-DD, `n` days before `day`. */
export function daysBefore(day, n) {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

/**
 * The log of `dayCount` days ending `lastDay`, added up.
 * Returns { lines (newest first), rows (one per person, most use first), features,
 * pool, used, poolPct, days: [{ day, used, people }], up, down } (up/down: 👍/👎 votes).
 */
export function aiActivity(lines, { lastDay, dayCount = 1 } = {}) {
    const list = (lines || []).map((l) => ({ ...l, atMs: ms(l.at) })).sort((a, b) => b.atMs - a.atMs);
    const poolPerDay = Number(list.find((l) => Number(l.pool) > 0)?.pool) || 0;
    const pool = poolPerDay * dayCount;

    const people = new Map();
    const perDay = new Map();
    const features = {};
    for (const l of [...list].reverse()) {
        features[l.feature] = (features[l.feature] || 0) + 1;
        const d = perDay.get(l.day) || { day: l.day, used: 0, people: new Set() };
        d.people.add(l.uid);
        if (counts(l)) d.used++;
        perDay.set(l.day, d);
        if (!l.uid) continue;
        const p = people.get(l.uid) || { uid: l.uid, name: '', email: '', uses: 0, requests: 0, errors: 0, limited: 0, cached: 0, up: 0, down: 0, features: {}, limits: {}, days: new Set(), last: 0 };
        p.name = l.name || p.name;
        p.email = l.email || p.email;
        p.uses++;
        p.features[l.feature] = (p.features[l.feature] || 0) + 1;
        if (counts(l)) p.requests++;
        if (l.status === 'error') p.errors++;
        if (l.status === 'limit') p.limited++;
        if (l.status === 'cached') p.cached++;
        if (Number(l.vote) === 1) p.up++;
        if (Number(l.vote) === -1) p.down++;
        // The limit of each feature group on each day the person used it.
        if (Number(l.limit) > 0) p.limits[`${l.day}|${limitGroup(l.feature)}`] = Number(l.limit);
        p.days.add(l.day);
        p.last = Math.max(p.last, l.atMs);
        people.set(l.uid, p);
    }

    const rows = [...people.values()]
        .map(({ limits, days, ...p }) => {
            const limit = Object.values(limits).reduce((s, n) => s + n, 0);
            return { ...p, limit, daysUsed: days.size, ofLimit: pct(p.requests, limit), ofPool: pct(p.requests, pool) };
        })
        .sort((a, b) => b.requests - a.requests || b.last - a.last);

    const used = rows.reduce((s, r) => s + r.requests, 0);
    const days = [];
    if (lastDay) {
        for (let i = 0; i < dayCount; i++) {
            const day = daysBefore(lastDay, i);
            const d = perDay.get(day);
            days.push({ day, used: d?.used || 0, people: d?.people.size || 0, pct: pct(d?.used || 0, poolPerDay) });
        }
    }
    const up = rows.reduce((s, r) => s + r.up, 0);
    const down = rows.reduce((s, r) => s + r.down, 0);
    return { lines: list, rows, features, pool, poolPerDay, used, poolPct: pct(used, pool), days, people: rows.length, uses: list.length, up, down };
}
