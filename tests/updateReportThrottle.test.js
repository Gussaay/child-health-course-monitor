// updateReportThrottle (src/utils/updateReportThrottle.js): the same
// update failure from the same phone is reported once a day, not once
// per launch.
import { describe, it, expect } from 'vitest';
import {
    shouldReportUpdate, markUpdateReported,
    loadUpdateReportMap, saveUpdateReportMap,
    UPDATE_REPORT_GAP_MS,
} from '../src/utils/updateReportThrottle';

const HOUR = 60 * 60 * 1000;

describe('shouldReportUpdate / markUpdateReported', () => {
    it('reports the first time, stays quiet within a day, reports again after', () => {
        const t0 = 1_000_000_000;
        expect(shouldReportUpdate({}, 'ota|Failed to fetch', t0)).toBe(true);
        const map = markUpdateReported({}, 'ota|Failed to fetch', t0);
        expect(shouldReportUpdate(map, 'ota|Failed to fetch', t0 + HOUR)).toBe(false);
        expect(shouldReportUpdate(map, 'ota|Failed to fetch', t0 + UPDATE_REPORT_GAP_MS + 1)).toBe(true);
    });

    it('a different failure is never throttled by an earlier one', () => {
        const map = markUpdateReported({}, 'ota|Failed to fetch', 1000);
        expect(shouldReportUpdate(map, 'install|checksum', 1001)).toBe(true);
    });

    it('prunes stale entries when stamping a new one', () => {
        const t0 = 10 * UPDATE_REPORT_GAP_MS;
        const map = markUpdateReported({ old: 0, fresh: t0 - HOUR }, 'new', t0);
        expect(map).toEqual({ fresh: t0 - HOUR, new: t0 });
    });
});

describe('storage round-trip', () => {
    it('survives a round trip and shrugs off broken storage', () => {
        const store = { v: null, getItem(k) { return this.v; }, setItem(k, val) { this.v = val; } };
        saveUpdateReportMap(store, { a: 123 });
        expect(loadUpdateReportMap(store)).toEqual({ a: 123 });

        const broken = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
        expect(loadUpdateReportMap(broken)).toEqual({});
        expect(() => saveUpdateReportMap(broken, {})).not.toThrow();
        expect(loadUpdateReportMap(null)).toEqual({});
    });
});
