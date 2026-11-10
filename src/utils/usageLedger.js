// ============================================================================
// USAGE LEDGER: what each user, list and page costs, month by month
//
// data.js wraps every Firestore read and write, so the app knows how many it
// made. This module keeps that count broken down by
//   - list (the Firestore collection touched: courses, participants, ...),
//   - page (the screen the user was on),
//   - source (the user's own action, a live listener, or an automatic sync),
// and builds the monthly document each user's device adds it to:
//
//   usageMonthly/<YYYY-MM>_<uid>
//     month, email, reads, writes, trackingWrites, lastUpdated
//     byCollection.<name>.{r,w}   byView.<name>.{r,w}   bySource.<name>.{r,w}
//
// The admin dashboard adds the documents up. What it shows is an ESTIMATE from
// the operations the app itself counted, priced with the rates below. It cannot
// see Cloud Functions, Storage, Hosting or AI services; the bill entered beside
// it makes that remainder visible.
// ============================================================================

// Firestore list prices, US dollars per operation (per 100,000: reads 0.06,
// writes 0.18). Regions differ; the admin screen lets the rates be changed.
export const DEFAULT_PRICES = { read: 0.06 / 100000, write: 0.18 / 100000 };

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Field names inside the monthly document: no dots, slashes or spaces.
export const safeKey = (name) => String(name || 'other').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40) || 'other';

let view = 'unknown';
let sourceOverride = null;
/** The page the user is on; every operation is filed under it. */
export const setUsageView = (v) => { view = safeKey(v); };
/** Files operations under `source` ('auto-sync') until cleared with null. */
export const setUsageSource = (s) => { sourceOverride = s ? safeKey(s) : null; };

const emptyBucket = () => ({ reads: 0, writes: 0, byCollection: {}, byView: {}, bySource: {} });
let pending = emptyBucket();

const bump = (group, key, type, count) => {
    const row = group[key] || (group[key] = { r: 0, w: 0 });
    if (type === 'read') row.r += count; else row.w += count;
};

/** Counts `count` operations of `type` ('read' | 'write') on a collection. */
export const recordOperation = (type, count, { collection = 'other', source } = {}) => {
    if (!(count > 0)) return;
    const c = safeKey(collection);
    const s = safeKey(source || sourceOverride || 'user');
    if (type === 'read') pending.reads += count; else pending.writes += count;
    bump(pending.byCollection, c, type, count);
    bump(pending.byView, view, type, count);
    bump(pending.bySource, s, type, count);
};

export const hasPending = () => pending.reads > 0 || pending.writes > 0;

/** Hands over what has been counted since the last call, and starts again. */
export const takePending = () => { const out = pending; pending = emptyBucket(); return out; };
/** Puts a bucket back (its write failed), so nothing counted is lost. */
export const restorePending = (bucket) => {
    pending.reads += bucket.reads;
    pending.writes += bucket.writes;
    ['byCollection', 'byView', 'bySource'].forEach((g) => {
        Object.entries(bucket[g]).forEach(([k, v]) => {
            const row = pending[g][k] || (pending[g][k] = { r: 0, w: 0 });
            row.r += v.r; row.w += v.w;
        });
    });
};

/**
 * The monthly document update for a bucket. `inc` is Firestore's increment()
 * and `stamp` serverTimestamp(), passed in so this file stays free of Firebase.
 * `trackingWrites` is the cost of keeping these counts (each flush is two
 * writes), so the overhead of measuring is itself visible.
 */
export const monthlyPayload = (bucket, { inc, stamp, email, month = monthKey(), trackingWrites = 0 }) => {
    const group = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, {
        ...(v.r ? { r: inc(v.r) } : {}), ...(v.w ? { w: inc(v.w) } : {}),
    }]));
    return {
        month,
        email: email || 'unknown',
        reads: inc(bucket.reads),
        writes: inc(bucket.writes),
        trackingWrites: inc(trackingWrites),
        byCollection: group(bucket.byCollection),
        byView: group(bucket.byView),
        bySource: group(bucket.bySource),
        lastUpdated: stamp(),
    };
};

/** Estimated dollars for a number of reads and writes. */
export const estimateCost = (reads, writes, prices = DEFAULT_PRICES) =>
    (reads || 0) * prices.read + (writes || 0) * prices.write;

const addRow = (map, key, r, w) => { const row = map[key] || (map[key] = { r: 0, w: 0 }); row.r += r || 0; row.w += w || 0; };

/**
 * Adds the monthly documents up: totals, and a ranked list by user, list, page
 * and source, each with its estimated cost. Highest cost first.
 */
export const summariseUsage = (docs, prices = DEFAULT_PRICES) => {
    const totals = { reads: 0, writes: 0, trackingWrites: 0, users: 0 };
    const users = {};
    const groups = { byCollection: {}, byView: {}, bySource: {} };
    (docs || []).forEach((d) => {
        totals.reads += d.reads || 0;
        totals.writes += d.writes || 0;
        totals.trackingWrites += d.trackingWrites || 0;
        totals.users += 1;
        const who = d.email || d.id || 'unknown';
        addRow(users, who, d.reads, d.writes);
        Object.keys(groups).forEach((g) => {
            Object.entries(d[g] || {}).forEach(([k, v]) => addRow(groups[g], k, v.r, v.w));
        });
    });
    const rank = (map) => Object.entries(map)
        .map(([name, v]) => ({ name, reads: v.r, writes: v.w, cost: estimateCost(v.r, v.w, prices) }))
        .sort((a, b) => b.cost - a.cost || b.reads - a.reads);
    return {
        totals: { ...totals, cost: estimateCost(totals.reads, totals.writes, prices), trackingCost: estimateCost(0, totals.trackingWrites, prices) },
        byUser: rank(users),
        byCollection: rank(groups.byCollection),
        byView: rank(groups.byView),
        bySource: rank(groups.bySource),
    };
};

/** Test helper: forget everything counted. */
export const resetLedger = () => { pending = emptyBucket(); view = 'unknown'; sourceOverride = null; };
