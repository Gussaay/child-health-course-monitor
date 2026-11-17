import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NATIONAL_GUIDES, missingNationalBoxes, addMissingNationalBoxes } from '../src/components/imnci/treatmentGuides';
import { guideForTopic } from '../src/components/imnci/topics';
import { GrowthChartsBox } from '../src/components/imnci/OfficialGrowthChart';

const ids = (doc) => doc.groups.flatMap((g) => g.blocks.map((b) => `${g.id}.${b.id}`));
const ADDED = {
    guide_child: ['oral.steps', 'clinic.steps', 'clinic.im_antibiotics', 'clinic.quinine', 'clinic.diazepam', 'clinic.low_sugar', 'counsel.recommendations', 'counsel.warnings', 'growth.charts'],
    guide_infant: ['clinic.im_antibiotics', 'clinic.low_sugar', 'counsel.cup', 'counsel.warm_home', 'growth.wfa'],
};

describe('chart booklet items added to protocol management', () => {
    it('has every added box in English and Arabic, with matching lines and tables', () => {
        Object.entries(ADDED).forEach(([ft, list]) => {
            const doc = NATIONAL_GUIDES[ft];
            list.forEach((id) => {
                const [g, b] = id.split('.');
                const box = doc.groups.find((x) => x.id === g).blocks.find((x) => x.id === b);
                expect(box, id).toBeTruthy();
                expect(box.en.title && box.ar.title, id).toBeTruthy();
                expect((box.en.lines || []).length, id).toBe((box.ar.lines || []).length);
                expect((box.en.rows || []).length, id).toBe((box.ar.rows || []).length);
                (box.en.rows || []).forEach((r, i) => expect(r.length, `${id} row ${i}`).toBe((box.en.columns || []).length));
            });
        });
    });

    it('shows each added box on an illness tab or on General', () => {
        const known = { guide_child: ['danger', 'cough', 'diarrhea', 'fever', 'ear', 'malnutrition', 'anemia'], guide_infant: ['bacterial_infection', 'jaundice', 'diarrhea', 'feeding_problem'] };
        Object.entries(ADDED).forEach(([ft, list]) => {
            const part = ft === 'guide_child' ? 'child' : 'infant';
            const doc = NATIONAL_GUIDES[ft];
            const shown = new Set();
            [...known[ft], 'general'].forEach((tp) => {
                const g = guideForTopic(part, tp, doc, known[ft]);
                [...g.treat, ...g.counsel, ...g.followup].forEach(({ gi, bi }) => shown.add(`${doc.groups[gi].id}.${doc.groups[gi].blocks[bi].id}`));
            });
            list.forEach((id) => expect(shown.has(id), id).toBe(true));
        });
        const malnutrition = guideForTopic('child', 'malnutrition', NATIONAL_GUIDES.guide_child, known.guide_child);
        expect(malnutrition.treat.some(({ gi }) => NATIONAL_GUIDES.guide_child.groups[gi].id === 'growth')).toBe(true);
    });

    it('finds the boxes a saved document lacks and adds them in booklet order, keeping its own edits', () => {
        const national = NATIONAL_GUIDES.guide_infant;
        const saved = JSON.parse(JSON.stringify(national));
        saved.groups = saved.groups.filter((g) => !['clinic', 'growth'].includes(g.id));
        const counsel = saved.groups.find((g) => g.id === 'counsel');
        counsel.blocks = counsel.blocks.filter((b) => !['cup', 'warm_home'].includes(b.id));
        counsel.blocks[0].en.title = 'Edited by the program';
        expect(missingNationalBoxes(saved, national).map((m) => `${m.group}.${m.block}`).sort()).toEqual([...ADDED.guide_infant].sort());
        const merged = addMissingNationalBoxes(saved, national);
        expect(ids(merged)).toEqual(ids(national));
        expect(merged.groups.find((g) => g.id === 'counsel').blocks[0].en.title).toBe('Edited by the program');
        expect(missingNationalBoxes(merged, national)).toEqual([]);
    });

    it('shows the booklet chart with a plotter in the growth box', () => {
        const html = renderToStaticMarkup(React.createElement(GrowthChartsBox, { kinds: ['wfl', 'wfh'], lang: 'ar' }));
        expect(html).toContain('data-chart="ar-wfl-girls"');
        expect(html).toContain('Plot a child');
        expect(renderToStaticMarkup(React.createElement(GrowthChartsBox, { kinds: ['wfa'] }))).toContain('data-chart="en-wfa-girls"');
    });
});
