import { describe, it, expect } from 'vitest';
import { aiActivity, daysBefore, featureLabel } from '../src/utils/aiActivity';

const lines = [
    { uid: 'u1', name: 'Amna', feature: 'assistant', what: 'How many courses?', status: 'ok', used: 1, limit: 20, pool: 212, day: '2026-10-25', at: { seconds: 100 } },
    { uid: 'u1', name: 'Amna', feature: 'library:ask', what: 'Danger signs', status: 'ok', used: 1, limit: 60, pool: 212, day: '2026-10-25', at: { seconds: 200 } },
    { uid: 'u1', name: 'Amna', feature: 'assistant', what: 'And by state?', status: 'ok', used: 2, limit: 20, pool: 212, day: '2026-10-24', at: { seconds: 50 } },
    { uid: 'u2', email: 'b@x.org', feature: 'library:sectionSummary', status: 'cached', limit: 0, pool: 212, day: '2026-10-25', at: { seconds: 300 } },
    { uid: 'u2', email: 'b@x.org', feature: 'assistant', status: 'limit', used: 20, limit: 20, pool: 212, day: '2026-10-25', at: { seconds: 400 } },
    { uid: 'u3', feature: 'assistant', status: 'error', error: 'busy', used: 1, limit: 60, pool: 212, day: '2026-10-25', at: { seconds: 10 } },
];

describe('AI activity', () => {
    it('counts each person against their own limits and the pool', () => {
        const a = aiActivity(lines, { lastDay: '2026-10-25', dayCount: 1 });
        expect(a.lines[0].status).toBe('limit'); // newest first
        expect(a.pool).toBe(212);
        const amna = a.rows[0];
        expect(amna.uid).toBe('u1');
        expect(amna.requests).toBe(3);
        expect(amna.limit).toBe(100); // assistant 20 on two days + library 60
        expect(amna.ofLimit).toBe(3);
        expect(amna.ofPool).toBe(1.4);
        expect(amna.daysUsed).toBe(2);
        const b = a.rows.find((r) => r.uid === 'u2');
        expect(b.requests).toBe(0);
        expect(b.limited).toBe(1);
        expect(b.cached).toBe(1);
        expect(a.rows.find((r) => r.uid === 'u3').errors).toBe(1);
        expect(a.used).toBe(4);
    });

    it('adds up a range of days against that many days of pool', () => {
        const a = aiActivity(lines, { lastDay: '2026-10-25', dayCount: 7 });
        expect(a.pool).toBe(212 * 7);
        expect(a.days).toHaveLength(7);
        expect(a.days[0]).toMatchObject({ day: '2026-10-25', used: 3, people: 3 });
        expect(a.days[1]).toMatchObject({ day: '2026-10-24', used: 1, people: 1 });
        expect(a.days[2].used).toBe(0);
    });

    it('handles no use at all', () => {
        const a = aiActivity([], { lastDay: '2026-10-25' });
        expect(a.people).toBe(0);
        expect(a.poolPct).toBe(null);
        expect(daysBefore('2026-10-01', 1)).toBe('2026-09-30');
        expect(featureLabel('assistant')).toBe('Ask the data');
    });
});
