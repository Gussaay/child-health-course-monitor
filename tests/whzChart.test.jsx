import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WhzChart, { chartWindow } from '../src/components/imnci/WhzChart';

const noah = { sex: 'male', ageMonths: 28, weightKg: 12.7, lengthCm: 104 };

describe('weight-for-height chart on the recording form', () => {
    it('plots the real weight and height inside the window, under the -3 line for Noah', () => {
        const w = chartWindow(noah);
        expect(w.x0).toBeLessThanOrEqual(104);
        expect(w.x1).toBeGreaterThanOrEqual(104);
        expect(w.yMin).toBeLessThan(12.7);
        expect(w.yMax).toBeGreaterThan(12.7);
        const at104 = w.rows.find((r) => r.x === 104);
        expect(12.7).toBeLessThan(at104['-3']);
        const html = renderToStaticMarkup(React.createElement(WhzChart, { child: noah }));
        expect(html).toContain('data-testid="whz-point"');
        expect(html).toContain('12.7');
        expect(html).toContain('104');
        expect(html).toContain('#dc2626');
    });

    it('uses the length table under 2 years and the height table from 2 years', () => {
        expect(chartWindow({ ...noah, ageMonths: 12, lengthCm: 75, weightKg: 9 }).under2).toBe(true);
        expect(chartWindow(noah).under2).toBe(false);
    });

    it('shows nothing until weight, length, age and sex are filled, and says when the length is off the chart', () => {
        expect(renderToStaticMarkup(React.createElement(WhzChart, { child: { ...noah, lengthCm: '' } }))).toBe('');
        expect(chartWindow({ ...noah, lengthCm: 140 }).outOfRange).toBe(true);
        expect(renderToStaticMarkup(React.createElement(WhzChart, { child: { ...noah, lengthCm: 140 } }))).toContain('outside the chart');
    });
});
