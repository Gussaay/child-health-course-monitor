import { describe, it, expect } from 'vitest';
import { OSCE_CHECKLISTS, getOsceChecklist, osceSteps, scoreOsce, buildOsceRecord } from '../src/components/cpcm/osceChecklists.js';

const allDone = (c, except = []) =>
    Object.fromEntries(osceSteps(c).map(s => [s.id, except.includes(s.id) ? 'not_done' : 'done']));

describe('community midwife OSCE checklists', () => {
    it('match the paper forms: step counts and pass marks', () => {
        const shape = Object.fromEntries(OSCE_CHECKLISTS.map(c => [c.id, [osceSteps(c).length, c.passMark]]));
        expect(shape).toEqual({ eceb_a: [20, 16], eceb_b: [13, 10], hbb_a: [13, 10], hbb_b: [18, 14], bag_mask: [7, 7] });
    });

    it('use unique step ids within each checklist', () => {
        OSCE_CHECKLISTS.forEach(c => {
            const ids = osceSteps(c).map(s => s.id);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    it('marks the starred HBB steps as critical', () => {
        expect(osceSteps(getOsceChecklist('hbb_a')).filter(s => s.critical).map(s => s.id)).toEqual(['h5', 'h7', 'h9']);
        expect(osceSteps(getOsceChecklist('hbb_b')).filter(s => s.critical).map(s => s.id)).toEqual(['g6', 'g9', 'g10', 'g14']);
    });

    it('passes on the pass mark and counts blank steps as not done', () => {
        const c = getOsceChecklist('eceb_a');
        const answers = allDone(c, ['a1', 'a2', 'a3', 'a4']);
        expect(scoreOsce(c, answers)).toMatchObject({ score: 16, total: 20, passed: true });
        delete answers.a5;
        expect(scoreOsce(c, answers)).toMatchObject({ score: 15, answered: 19, passed: false });
    });

    it('fails when a critical step is missed even above the pass mark', () => {
        const c = getOsceChecklist('hbb_a');
        const r = scoreOsce(c, allDone(c, ['h5']));
        expect(r.score).toBe(12);
        expect(r.passed).toBe(false);
        expect(r.criticalMissed).toEqual(['h5']);
    });

    it('keeps the first attempt score when the record is saved again', () => {
        const c = getOsceChecklist('bag_mask');
        const first = buildOsceRecord(c, allDone(c, ['m3', 'm7']), null, { assessor: 'Trainer', now: new Date('2026-10-30T10:00:00Z') });
        expect(first).toMatchObject({ score: 5, firstScore: 5, passed: false, assessor: 'Trainer' });
        const second = buildOsceRecord(c, allDone(c), first, { assessor: 'Other', now: new Date('2026-10-30T10:20:00Z') });
        expect(second).toMatchObject({ score: 7, firstScore: 5, passed: true, assessedAt: first.assessedAt, assessor: 'Other' });
    });
});
