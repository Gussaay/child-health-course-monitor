// src/utils/problemGroups.js
//
// Grouping for Admin → Problems.
//
// Reports arrive one row per occurrence, so the tab showed 214 open
// reports that were really about four problems repeating — one phone
// retried a broken screen download 14 times in a minute and filed 14
// "different" crashes. Nobody can triage a list like that.
//
// problemSignature() reduces a report to the problem it belongs to: kind,
// the message with the parts that change every time removed (dates, the
// hashed file name that changes every release, long ids, hex numbers),
// and the screen. groupProblemReports() folds a list of reports into
// groups with a count, the screens and accounts affected, and the first
// and last date — the questions a triage actually asks.
//
// New reports are stamped with their signature in data.js
// (submitProblemReport), so grouping is also available to queries and to
// the AI analysis; the tab groups older reports on the fly with the same
// function, so the two always agree.

/** createdAt arrives as a Firestore Timestamp, a Date, millis or an ISO string. */
export function reportMillis(report) {
    const v = report?.createdAt;
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    const parsed = Date.parse(v);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function normaliseTitle(raw) {
    return String(raw || '')
        // A Firestore listener error starts with its own timestamp.
        .replace(/\[20\d\d-\d\d-\d\dT[^\]]*\]\s*/g, '')
        .replace(/\b20\d\d-\d\d-\d\d[T ]\d\d:\d\d(:\d\d)?(\.\d+)?(Z|[+-]\d\d:?\d\d)?\b/g, '')
        // The hashed chunk name changes every release; the screen it belongs to does not.
        .replace(/([A-Za-z][A-Za-z0-9]*)-[A-Za-z0-9_-]{6,}\.(js|css)\b/g, '$1.$2')
        // Query strings and long ids differ per course/facility, not per problem.
        .replace(/\?[^\s'"]+/g, '')
        .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '<id>')
        .replace(/\b[A-Za-z0-9]{20,}\b/g, '<id>')
        .replace(/0x[0-9a-f]+/gi, '0x…')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .slice(0, 160);
}

/** The group a report belongs to, as one comparable string. */
export function problemSignature(report) {
    const kind = String(report?.kind || 'report');
    const title = normaliseTitle(report?.what || report?.message || '');
    const screen = String(report?.screen || '').trim().toLowerCase();
    return `${kind}|${screen}|${title}`;
}

/**
 * Folds reports into groups, most frequent first (then most recent).
 * Each group: { key, kind, title, count, openCount, screens, accounts,
 * firstAt, lastAt, reports } — times in millis (0 when a report has none).
 */
export function groupProblemReports(reports) {
    const byKey = new Map();
    for (const report of reports || []) {
        const key = problemSignature(report);
        let group = byKey.get(key);
        if (!group) {
            group = {
                key,
                kind: String(report?.kind || 'report'),
                title: String(report?.what || report?.message || '(no description)'),
                count: 0,
                openCount: 0,
                screens: new Set(),
                accounts: new Set(),
                firstAt: 0,
                lastAt: 0,
                reports: [],
            };
            byKey.set(key, group);
        }
        group.count += 1;
        if (report?.status !== 'resolved') group.openCount += 1;
        if (report?.screen) group.screens.add(report.screen);
        const account = report?.reporterEmail || report?.reporterName;
        if (account) group.accounts.add(account);
        const at = reportMillis(report);
        if (at) {
            if (!group.firstAt || at < group.firstAt) group.firstAt = at;
            if (at > group.lastAt) group.lastAt = at;
        }
        group.reports.push(report);
    }
    return [...byKey.values()]
        .map((g) => ({ ...g, screens: [...g.screens], accounts: [...g.accounts] }))
        .sort((a, b) => (b.count - a.count) || (b.lastAt - a.lastAt));
}
