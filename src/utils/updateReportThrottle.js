// src/utils/updateReportThrottle.js
//
// One update failure, one report a day.
//
// reportUpdateError (utils/updateTelemetry.js) already dedupes within a
// session, but a phone that cannot download an update relaunches the app
// many times a day, and every launch filed the same failure again —
// Admin → Problems carried the same "Failed to fetch" from the same
// phones day after day, burying new problems. The throttle persists the
// last report time per error in localStorage, so the same failure is
// reported at most once per UPDATE_REPORT_GAP_MS across launches, while a
// *different* failure is still reported immediately.

export const UPDATE_REPORT_GAP_MS = 24 * 60 * 60 * 1000;
export const UPDATE_REPORT_STORAGE_KEY = 'update_error_reported_at_v1';

/** True when this error has not been reported within the gap. */
export function shouldReportUpdate(map, key, now, gapMs = UPDATE_REPORT_GAP_MS) {
    const last = map?.[key];
    return !(typeof last === 'number' && now - last < gapMs);
}

/** A new map with this error stamped at `now`, and stale entries pruned. */
export function markUpdateReported(map, key, now, gapMs = UPDATE_REPORT_GAP_MS) {
    const next = { ...(map || {}) };
    for (const [k, v] of Object.entries(next)) {
        if (typeof v !== 'number' || now - v >= gapMs) delete next[k];
    }
    next[key] = now;
    return next;
}

/** Reads the stored map from a Web Storage object; {} on any problem. */
export function loadUpdateReportMap(storage, name = UPDATE_REPORT_STORAGE_KEY) {
    try {
        const parsed = JSON.parse(storage?.getItem?.(name) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

/** Writes the map back; storage failures are ignored (reporting is best-effort). */
export function saveUpdateReportMap(storage, map, name = UPDATE_REPORT_STORAGE_KEY) {
    try {
        storage?.setItem?.(name, JSON.stringify(map || {}));
    } catch { /* full or unavailable storage must never break an update */ }
}
