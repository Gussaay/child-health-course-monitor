import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CHARTS from '../src/components/imnci/growthCharts.json';
import { getChart, plotChild, toPixel, fromPixel, ageInWeeks, kindForAge, WEEKS_PER_MONTH } from '../src/components/imnci/growthCharts';
import OfficialGrowthChart, { pickValue, FormGrowthChart } from '../src/components/imnci/OfficialGrowthChart';
import GrowthChartBlock, { isClose, blockBand } from '../src/components/imnci/onlineCourses/GrowthChartBlock';
import { growthChartErrors } from '../src/components/imnci/onlineCourses/coursePackage';

const noah = { sex: 'male', ageMonths: 28, weightKg: 12.7, lengthCm: 104 };

describe('official WHO charts from the Sudan chart booklet', () => {
    it('has all six charts in both the English and the Arabic booklet, each with its image', () => {
        expect(Object.keys(CHARTS)).toHaveLength(12);
        for (const lang of ['en', 'ar']) for (const kind of ['wfl', 'wfh', 'wfa']) for (const sex of ['male', 'female']) {
            const c = getChart(kind, sex, lang);
            expect(c, `${lang} ${kind} ${sex}`).toBeTruthy();
            expect(c.lang).toBe(lang);
            expect(c.url).toMatch(/\.webp/);
        }
        expect(getChart('wfl', 'female', 'ar-SD').id).toBe('ar-wfl-girls');
        expect(getChart('wfl', '', 'en')).toBeNull();
    });

    it('covers the printed range of each chart: 45-110 cm, 65-120 cm and birth to 6 months', () => {
        const range = { wfl: [45, 110], wfh: [65, 120], wfa: [0, 6 * WEEKS_PER_MONTH] };
        Object.entries(CHARTS).forEach(([id, c]) => {
            expect(c.x[0], id).toBeLessThanOrEqual(range[c.kind][0] + 0.1);
            expect(c.x[1], id).toBeGreaterThanOrEqual(range[c.kind][1]);
            expect(c.xB, id).toBeGreaterThan(0);
            expect(c.yB, id).toBeLessThan(0); // heavier is higher up the page
            // The whole grid lies on the image.
            const a = toPixel(c, c.x[0], c.kg[1]); const b = toPixel(c, c.x[1], c.kg[0]);
            expect(a.px).toBeGreaterThan(0); expect(a.py).toBeGreaterThan(0);
            expect(b.px).toBeLessThan(c.width); expect(b.py).toBeLessThan(c.height);
        });
    });

    it('maps values to pixels and back', () => {
        const c = getChart('wfh', 'male', 'en');
        const { px, py } = toPixel(c, 104, 12.7);
        const v = fromPixel(c, px, py);
        expect(v.x).toBeCloseTo(104, 6); expect(v.kg).toBeCloseTo(12.7, 6);
        expect(pickValue(c, px + 1, py - 1)).toEqual({ x: 104, kg: 12.7 });
    });

    it('picks the length chart under 2 years and the height chart from 2 years, and plots Noah', () => {
        expect(kindForAge(23.9)).toBe('wfl');
        expect(kindForAge(24)).toBe('wfh');
        const p = plotChild(noah, { lang: 'en' });
        expect(p.chart.id).toBe('en-wfh-boys');
        expect(p).toMatchObject({ x: 104, kg: 12.7, inRange: true });
        expect(plotChild({ ...noah, lengthCm: 140 }).inRange).toBe(false);
        expect(plotChild({ ...noah, weightKg: '' }).x).toBeNull();
    });

    it('turns days, weeks or months into weeks for weight-for-age', () => {
        expect(ageInWeeks({ ageDays: 21 })).toBe(3);
        expect(ageInWeeks({ ageWeeks: 6 })).toBe(6);
        expect(ageInWeeks({ ageMonths: 3 })).toBeCloseTo(13.04, 2);
        const p = plotChild({ sex: 'female', ageWeeks: 8, weightKg: 4.1 }, { kind: 'wfa', lang: 'ar' });
        expect(p.chart.id).toBe('ar-wfa-girls');
        expect(p.inRange).toBe(true);
    });

    it('draws the child on the booklet image on the recording form', () => {
        const html = renderToStaticMarkup(React.createElement(FormGrowthChart, { child: noah }));
        expect(html).toContain('data-chart="en-wfh-boys"');
        expect(html).toContain('data-testid="growth-point"');
        expect(html).toContain('#dc2626'); // below -3 z
        expect(renderToStaticMarkup(React.createElement(FormGrowthChart, { child: { ...noah, weightKg: '' } }))).toBe('');
    });

    it('draws nothing outside the grid', () => {
        const c = getChart('wfl', 'female', 'en');
        const html = renderToStaticMarkup(React.createElement(OfficialGrowthChart, { chart: c, point: { x: 130, kg: 9 } }));
        expect(html).not.toContain('growth-point');
    });
});

describe('"Plot on the chart" lesson activity', () => {
    const amna = { type: 'growthchart', title: 'Plot Amna', sex: 'female', ageMonths: 14, weightKg: 6.5, lengthCm: 74 };

    it('shows the case and the right booklet chart, waiting for the learner\'s mark', () => {
        const html = renderToStaticMarkup(React.createElement(GrowthChartBlock, { block: amna }));
        expect(html).toContain('data-chart="en-wfl-girls"');
        expect(html).toContain('Step 1');
        expect(html).not.toContain('growth-point'); // the answer is hidden until checked
    });

    it('knows the band from the WHO tables, and takes it from the author for weight-for-age', () => {
        expect(blockBand(amna)).toBe('Less than -3Z');
        expect(blockBand({ ...amna, weightKg: 9 })).toBe('-2 Z or more');
        expect(blockBand({ type: 'growthchart', chart: 'wfa', sex: 'male', ageWeeks: 10, weightKg: 4, lowWeightForAge: true })).toBe('low');
    });

    it('counts a mark within 1 cm and 0.2 kg as well placed', () => {
        expect(isClose({ x: 74.5, kg: 6.6 }, { x: 74, kg: 6.5 })).toBe(true);
        expect(isClose({ x: 76, kg: 6.5 }, { x: 74, kg: 6.5 })).toBe(false);
        expect(isClose({ x: 74, kg: 6.8 }, { x: 74, kg: 6.5 })).toBe(false);
    });

    it('is free practice when no weight is given', () => {
        const html = renderToStaticMarkup(React.createElement(GrowthChartBlock, { block: { type: 'growthchart', title: '' } }));
        expect(html).toContain('Try your own numbers');
    });

    it('is checked in a course file', () => {
        expect(growthChartErrors(amna)).toEqual([]);
        expect(growthChartErrors({ type: 'growthchart' })).toEqual([]);
        expect(growthChartErrors({ ...amna, lengthCm: 130 }).join()).toContain('outside the printed chart');
        expect(growthChartErrors({ ...amna, chart: 'wfh' }).join()).toContain('weight-for-length');
        expect(growthChartErrors({ ...amna, sex: '' }).join()).toContain('sex');
        expect(growthChartErrors({ type: 'growthchart', chart: 'wfa', sex: 'male', ageWeeks: 10, weightKg: 4 }).join()).toContain('low for age');
    });
});

describe('"Plot on the chart" in the WHO distance learning modules', () => {
    const pkg = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../course-packages/who-dimci-modules-1-9.imnci.json'), 'utf8'));
    const blocks = pkg.modules.flatMap((m) => m.sections.flatMap((s) => (s.read || []).filter((b) => b.type === 'growthchart').map((b) => ({ m: m.order, b }))));

    it('has the weight-for-age example in Module 2 and three plots in the Module 6 z-score lesson, all valid', () => {
        expect(blocks.filter((x) => x.m === 2).map((x) => x.b.chart)).toEqual(['wfa']);
        expect(blocks.filter((x) => x.m === 6)).toHaveLength(3);
        blocks.forEach(({ b }) => expect(growthChartErrors(b), b.title).toEqual([]));
        // Every case's explanation agrees with the WHO tables.
        expect(blocks.filter((x) => x.b.weightKg && x.b.chart !== 'wfa').map((x) => blockBand(x.b))).toEqual(['-2 Z or more', 'Between -3 and -2 Z']);
    });
});
