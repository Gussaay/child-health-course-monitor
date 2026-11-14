// Cloud Functions note their database reads (functions/usageTally.js) so the
// admin cost tab can show them beside the app's own count.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const tallyMod = require('../functions/usageTally.js');
const { tally, queryReads, countReads, flushUsage, payloadFor, _reset, _pending } = tallyMod;

const fakeDb = (fail = false) => {
    const sets = [];
    return {
        sets,
        collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }),
        batch: () => ({
            set: (ref, data, opts) => sets.push({ path: ref.path, data, opts }),
            commit: async () => { if (fail) throw new Error('offline'); },
        }),
    };
};

describe('usageTally', () => {
    beforeEach(() => _reset());

    it('bills a query per document (at least one) and a count per 1,000', () => {
        expect(queryReads({ size: 0 })).toBe(1);
        expect(queryReads({ size: 250 })).toBe(250);
        expect(countReads(0)).toBe(1);
        expect(countReads(7012)).toBe(8);
    });

    it('waits until due, then writes one monthly document per function', async () => {
        tally('aiAssistant', 'participants', 120);
        tally('aiAssistant', 'courses', 30);
        tally('facilityDashboardCopy', 'healthFacilities', 8);
        const db = fakeDb();
        expect(await flushUsage(db)).toBe(false); // not due yet
        expect(await flushUsage(db, { now: Date.now() + 11 * 60 * 1000 })).toBe(true);
        expect(db.sets.map((s) => s.path).sort()).toEqual([
            expect.stringMatching(/^usageMonthly\/\d{4}-\d{2}_fn_aiAssistant$/),
            expect.stringMatching(/^usageMonthly\/\d{4}-\d{2}_fn_facilityDashboardCopy$/),
        ]);
        expect(db.sets.every((s) => s.opts && s.opts.merge)).toBe(true);
        expect(Object.keys(_pending())).toHaveLength(0);
    });

    it('writes at once when many reads piled up', async () => {
        tally('aiAssistant', 'healthFacilities', 6000);
        const db = fakeDb();
        expect(await flushUsage(db)).toBe(true);
    });

    it('keeps the counts when the write fails', async () => {
        tally('aiAssistant', 'participants', 40);
        expect(await flushUsage(fakeDb(true), { force: true })).toBe(false);
        expect(_pending().aiAssistant.reads).toBe(40);
        expect(_pending().aiAssistant.byCollection.participants.r).toBe(40);
    });

    it('builds the same shape the app writes, filed under the function', () => {
        const inc = vi.fn((n) => ({ inc: n }));
        const p = payloadFor('aiAssistant', { reads: 150, writes: 0, byCollection: { participants: { r: 150, w: 0 } } }, inc, () => 'now', '2026-11');
        expect(p.month).toBe('2026-11');
        expect(p.email).toBe('Cloud Function: aiAssistant');
        expect(p.byCollection.participants).toEqual({ r: { inc: 150 } });
        expect(p.byView.fn_aiAssistant).toEqual({ r: { inc: 150 } });
        expect(p.bySource.function).toEqual({ r: { inc: 150 } });
    });
});
