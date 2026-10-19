import { describe, expect, it } from 'vitest';
import {
    cascadeMonths, checklistsForService, defaultPeriodStart, estimateNeed, getChecklist,
    periodMonths, scoreAssessment, serviceDataCalc, warmerResults,
} from '../src/components/supervision/checklists';

describe('supervision checklists', () => {
    it('puts both forms under small and sick newborn', () => {
        expect(checklistsForService('SSNC').map((c) => c.id)).toEqual(['nicu_coe', 'infant_warmer']);
    });

    it('reports the quarter before the visit', () => {
        expect(defaultPeriodStart('2026-10-18')).toBe('2026-07');
        expect(defaultPeriodStart('2026-02-01')).toBe('2025-10');
        expect(periodMonths('2025-11')).toEqual(['2025-11', '2025-12', '2026-01']);
        expect(cascadeMonths('2026-07')).toHaveLength(9);
        expect(cascadeMonths('2026-07')[0]).toBe('2026-01');
    });

    it('estimates need as the form describes', () => {
        expect(estimateNeed(100, 12, 15)).toBe(15);
        expect(estimateNeed(100, 12, null)).toBe(12);
        expect(estimateNeed(100, null, null)).toBe(18);
        expect(estimateNeed(null, null, null)).toBeNull();
    });

    it('uses D7 only when D6 is blank', () => {
        const responses = {
            service_data: {
                lbw: { '2026-07': '10', '2026-08': '10' },
                placed_documented: { '2026-07': '5', '2026-08': '' },
                placed_estimated: { '2026-07': '9', '2026-08': '8' },
            },
        };
        const calc = serviceDataCalc(responses, '2026-07');
        expect(calc.months[0].placed).toBe(5);
        expect(calc.months[1].placed).toBe(8);
        expect(calc.months[2].need).toBeNull();
        expect(calc.total.coverage).toBeCloseTo(65);
    });

    it('works out the warmer results', () => {
        const r = warmerResults({
            devices: { distributed: { nest: '4' }, functioning: { nest: '3' } },
            use_practices: { staff_trained: { answer: true }, cleaned: { answer: false }, staff_trained_number: { answer: '6' } },
            reporting_cascade: { '2026-01': { need: '20', received: '10', registered: '8', dhis2: '4' } },
        }, '2026-07');
        expect(r.nestFunctioningPercent).toBe(75);
        expect(r.practices.percent).toBe(50);
        expect(r.staffTrained).toBe(6);
        expect(r.cascade.coverage).toBe(50);
        expect(r.cascade.registration).toBe(80);
        expect(r.cascade.dhis2).toBe(50);
    });

    it('does not count a cleared number as an answer', () => {
        const s = scoreAssessment(getChecklist('nicu_coe'), { wash: { toilets: { available: '' } } });
        expect(s.answered).toBe(0);
    });
});

describe('supervision progress', () => {
    it('counts answers per section and ignores a blank optional row', async () => {
        const { assessmentProgress, sectionProgress } = await import('../src/components/supervision/checklists');
        const warmer = getChecklist('infant_warmer');
        const service = warmer.sections.find((s) => s.id === 'service_data');
        const empty = sectionProgress(service, {}, { periodStart: '2026-07' });
        expect(empty.total).toBe(18); // six indicators × three months; D7 left out while blank
        const withD7 = sectionProgress(service, { placed_estimated: { '2026-07': '3' } }, { periodStart: '2026-07' });
        expect(withD7).toMatchObject({ answered: 1, total: 19 });
        const findings = warmer.sections.find((s) => s.id === 'findings');
        expect(sectionProgress(findings, { strengths: 'x', actions: [{ action: 'y' }] }).answered).toBe(2);
        const all = assessmentProgress(warmer, { periodStart: '2026-07', responses: {} });
        expect(all.percent).toBe(0);
        expect(Object.keys(all.sections)).toHaveLength(warmer.sections.length);
    });
});
