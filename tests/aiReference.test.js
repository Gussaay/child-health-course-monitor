import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { referenceData } from '../src/components/referenceData.js';

// =============================================================================
// read_reference: the Morbidity & Mortality figures, from any page.
// =============================================================================

const require = createRequire(import.meta.url);
const { readReference } = require('../functions/aiReference.js');
const built = require('../functions/referenceData.json');

describe('read_reference', () => {
    it('serves the same figures the dashboard shows (run scripts/build-reference-data.mjs after changing them)', () => {
        expect(built).toEqual(JSON.parse(JSON.stringify(referenceData())));
    });

    it('gives the national figure and every state for the indicators asked', () => {
        const out = readReference({ survey: 'mics', indicators: ['diarrhoea', 'pneumonia'] });
        expect(out.columns).toEqual(['place', 'diarrhoea', 'pneumonia']);
        expect(out.national).toEqual([29, 17.8]);
        expect(out.rows).toHaveLength(18);
    });

    it('gives the localities of a state, whatever its spelling', () => {
        const out = readReference({ survey: 's3m', state: 'gedaref state', indicators: ['diarrhoea'] });
        expect(out.state).toBe('Gedaref');
        expect(out.rows.length).toBeGreaterThan(3);
        expect(out.columns).toEqual(['place', 'diarrhoea']);
    });

    it('finds the same measure under the other survey\'s name', () => {
        const out = readReference({ survey: 's3m', indicators: ['diarrhoea', 'pneumonia'] });
        expect(out.columns).toEqual(['place', 'diarrhoea', 'ari']);
        expect(out.notInThisSurvey).toBeUndefined();
        expect(readReference({ survey: 'mics', indicators: ['diarrhoea', 'stunting'] }).notInThisSurvey).toEqual(['stunting']);
    });

    it('gives estimate series from a year', () => {
        const out = readReference({ survey: 'igme', indicators: ['u5mr'], fromYear: 2023 });
        expect(out.series.u5mr.rows.map((r) => r[0])).toEqual([2023, 2024]);
    });

    it('explains a survey or state it does not know', () => {
        expect(readReference({ survey: 'dhs' }).error).toMatch(/igme/);
        expect(readReference({ survey: 's3m', state: 'Atlantis' }).error).toMatch(/Gedaref/);
    });
});
