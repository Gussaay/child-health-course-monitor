// Google's own Firestore counts for the Usage tab: the request it makes to
// Cloud Monitoring, how the answer becomes days and cost, and what happens
// when Google refuses. Google is not called: the response is built by hand in
// the shape the Monitoring API documents.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadMonth, monthWindow, timeSeriesUrl, summarise, quotaDay } = require('../functions/googleUsageCore.js');

const point = (endTime, n) => ({ interval: { endTime }, value: { int64Value: String(n) } });
const answer = (...points) => ({ ok: true, status: 200, json: async () => ({ timeSeries: [{ points }] }) });

describe('month window', () => {
    it('covers the month, capped at now, and refuses bad or future months', () => {
        const now = new Date('2026-11-04T12:00:00Z');
        expect(monthWindow('2026-11', now)).toEqual({ start: '2026-11-01T00:00:00.000Z', end: '2026-11-04T12:00:00.000Z' });
        expect(monthWindow('2026-10', now)).toEqual({ start: '2026-10-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z' });
        expect(monthWindow('2026-12', now)).toBeNull();
        expect(monthWindow('nonsense', now)).toBeNull();
    });
    it('asks Monitoring for hourly sums of one metric, summed across series', () => {
        const url = timeSeriesUrl('proj', 'firestore.googleapis.com/document/read_count', { start: 'a', end: 'b' });
        expect(url).toContain('/projects/proj/timeSeries?');
        expect(decodeURIComponent(url)).toContain('metric.type="firestore.googleapis.com/document/read_count"');
        expect(url).toContain('aggregation.alignmentPeriod=3600s');
        expect(url).toContain('aggregation.crossSeriesReducer=REDUCE_SUM');
    });
});

describe('counts and cost', () => {
    it('buckets hours into Pacific-time days, where the free quota resets', () => {
        // Midnight in Los Angeles on 4 Nov is 08:00 UTC (UTC-8 after the clocks change).
        // An hour ending at 08:00 UTC is 23:00-24:00 on the 3rd; the next hour is the 4th.
        expect(quotaDay('2026-11-04T08:00:00Z')).toBe('2026-11-03');
        expect(quotaDay('2026-11-04T09:00:00Z')).toBe('2026-11-04');
    });
    it('charges only what is above each day\'s free quota', () => {
        const s = summarise({
            '2026-11-01': { reads: 40000, writes: 1000, deletes: 0 },        // all free
            '2026-11-02': { reads: 150000, writes: 30000, deletes: 0 },      // 100k reads and 10k writes billable
        });
        expect(s.totals.reads).toBe(190000);
        expect(s.billable).toEqual({ reads: 100000, writes: 10000, deletes: 0 });
        expect(s.costAfterFreeQuota).toBeCloseTo(0.06 + 0.018, 6);
        expect(s.costBeforeFreeQuota).toBeCloseTo((190000 / 1e5) * 0.06 + (31000 / 1e5) * 0.18, 6);
        expect(s.days.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02']);
    });
});

describe('loadMonth', () => {
    const now = new Date('2026-11-04T12:00:00Z');
    it('adds the three metrics up across pages', async () => {
        const calls = [];
        const fetchFn = async (url) => {
            calls.push(decodeURIComponent(url));
            if (url.includes('read_count')) {
                return url.includes('pageToken')
                    ? answer(point('2026-11-02T10:00:00Z', 500))
                    : { ok: true, status: 200, json: async () => ({ timeSeries: [{ points: [point('2026-11-02T09:00:00Z', 1000)] }], nextPageToken: 'p2' }) };
            }
            if (url.includes('write_count')) return answer(point('2026-11-02T09:00:00Z', 40));
            return answer();
        };
        const out = await loadMonth({ projectId: 'p', month: '2026-11', now, fetchFn, token: 't' });
        expect(out.totals).toEqual({ reads: 1500, writes: 40, deletes: 0 });
        expect(calls.filter((c) => c.includes('read_count'))).toHaveLength(2);
        expect(out.costAfterFreeQuota).toBe(0); // far below the free quota
    });
    it('turns a refusal into a message that names the fix', async () => {
        const fetchFn = async () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'Permission monitoring.timeSeries.list denied' } }) });
        await expect(loadMonth({ projectId: 'p', month: '2026-11', now, fetchFn, token: 't' })).rejects.toThrow(/Monitoring Viewer/);
    });
    it('refuses a month that has not started', async () => {
        await expect(loadMonth({ projectId: 'p', month: '2027-01', now, fetchFn: async () => ({}), token: 't' })).rejects.toThrow(/month that has started/);
    });
});
