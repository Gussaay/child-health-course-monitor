import { describe, it, expect } from 'vitest';
import {
    PLAN_IMPORT_FIELDS, guessPlanMapping, planNumber, rowToIntervention,
} from '../src/components/PlanningView';

// =============================================================================
// Bulk upload of a master plan.
//
// The importer this replaces read the workbook by exact Arabic header string —
// row['المحور'], row['الأساس'] — and every field fell back when the heading did
// not match: `|| AXIS_OPTIONS[0]`, `Number(...) || 0`. A file from a state
// office whose heading said "محور التدخل" imported a page of zeros and
// reported success. These tests are about that failure.
// =============================================================================

const idOf = () => 'generated-id';

describe('guessPlanMapping', () => {
    it('matches the headings the template itself writes', () => {
        const headers = ['المحور', 'النشاط', 'المؤشر', 'الأساس', 'الهدف'];
        expect(guessPlanMapping(headers)).toMatchObject({
            axis: 0, name: 1, indicator: 2, baseline: 3, target: 4,
        });
    });

    it('matches a heading that is worded differently', () => {
        // The case the old importer silently lost.
        expect(guessPlanMapping(['محور التدخل', 'اسم النشاط'])).toMatchObject({ axis: 0, name: 1 });
    });

    it('ignores spacing, punctuation and Arabic spelling variants', () => {
        expect(guessPlanMapping(['  الاساس : ', 'الهدف\n'])).toMatchObject({ baseline: 0, target: 1 });
    });

    it('matches English headings too', () => {
        expect(guessPlanMapping(['Activity', 'Baseline', 'Target', 'Cost']))
            .toMatchObject({ name: 0, baseline: 1, target: 2, totalCost: 3 });
    });

    it('never maps two fields onto one column', () => {
        const mapping = guessPlanMapping(['الهدف', 'الهدف']);
        const used = Object.values(mapping);
        expect(new Set(used).size).toBe(used.length);
    });

    it('leaves a field out rather than guessing wildly', () => {
        expect(guessPlanMapping(['something unrelated']).name).toBeUndefined();
    });
});

describe('planNumber', () => {
    it('reads a plain number', () => {
        expect(planNumber(1500)).toBe(1500);
        expect(planNumber('1500')).toBe(1500);
    });

    it('reads a number written with separators', () => {
        expect(planNumber('1,500')).toBe(1500);
        expect(planNumber('1 500')).toBe(1500);
    });

    it('reads Arabic-Indic digits', () => {
        expect(planNumber('١٥٠٠')).toBe(1500);
        expect(planNumber('۱۵۰۰')).toBe(1500);
    });

    it('treats an empty cell as nothing, not as a failure', () => {
        expect(planNumber('')).toBe(0);
        expect(planNumber(null)).toBe(0);
        expect(planNumber(undefined)).toBe(0);
    });
});

describe('rowToIntervention', () => {
    const mapping = { name: 0, axis: 1, baseline: 2, target: 3, q1: 4, notes: 5 };

    it('builds an intervention from a mapped row', () => {
        const { intervention, problems } = rowToIntervention(
            ['تدريب الكوادر', 'بناء القدرات', '10', '40', 'نعم', 'ملاحظة'], mapping, idOf);
        expect(problems).toEqual([]);
        expect(intervention).toMatchObject({
            name: 'تدريب الكوادر', axis: 'بناء القدرات',
            baseline: 10, target: 40, q1: true, notes: 'ملاحظة',
        });
    });

    it('reports a number it could not read instead of importing a zero', () => {
        // This is the whole point: "٤٠ مؤسسة" arriving as target 0 reads on
        // screen exactly like a target that really is zero.
        const { intervention, problems } = rowToIntervention(
            ['تدريب', 'بناء القدرات', '', 'أربعون', '', ''], mapping, idOf);
        expect(intervention.target).toBe(0);
        expect(problems.join(' ')).toContain('الهدف');
    });

    it('does not complain about a cell that really says zero', () => {
        const { problems } = rowToIntervention(['تدريب', '', '0', '٠', '', ''], mapping, idOf);
        expect(problems).toEqual([]);
    });

    it('requires the activity name', () => {
        const { problems } = rowToIntervention(['', '', '1', '2', '', ''], mapping, idOf);
        expect(problems.join(' ')).toContain('النشاط');
    });

    it('reads the quarter ticks in either language', () => {
        const only = { name: 0, q1: 1 };
        expect(rowToIntervention(['x', 'نعم'], only, idOf).intervention.q1).toBe(true);
        expect(rowToIntervention(['x', 'YES'], only, idOf).intervention.q1).toBe(true);
        expect(rowToIntervention(['x', 'لا'], only, idOf).intervention.q1).toBe(false);
        expect(rowToIntervention(['x', ''], only, idOf).intervention.q1).toBe(false);
    });

    it('keeps an id from the file so a re-upload updates rather than doubles', () => {
        const withId = { name: 0, id: 1 };
        expect(rowToIntervention(['x', 'inv_123'], withId, idOf).intervention.id).toBe('inv_123');
        expect(rowToIntervention(['x', ''], withId, idOf).intervention.id).toBe('generated-id');
    });

    it('leaves an unmapped field alone rather than writing a default over it', () => {
        // Merging an import into an existing row must not blank the fields the
        // spreadsheet did not carry.
        const { intervention } = rowToIntervention(['تدريب'], { name: 0 }, idOf);
        expect(intervention).not.toHaveProperty('govValue');
        expect(intervention).not.toHaveProperty('totalCost');
    });

    it('carries the funding columns the old template dropped', () => {
        const fields = PLAN_IMPORT_FIELDS.map((f) => f.key);
        ['govSource', 'govValue', 'extSource1', 'extValue1', 'extSource3', 'extValue3']
            .forEach((k) => expect(fields).toContain(k));
    });
});
