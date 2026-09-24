import { describe, it, expect } from 'vitest';
import { parsePopulationRows, buildTemplateRows } from '../src/components/PopulationView';
import {
    canonicalState, canonicalLocality, LOCALITY_ALIASES, STATE_LOCALITIES,
} from '../src/components/constants';
import { populationTargetId } from '../src/data';

// Mirrors the real EPI workbook's quirks: a title row above the header, a
// merged State column that only appears on the first row of each block, and a
// subtotal row closing each block.
const SHEET = [
    [null, 'EPI Projected Denominators by localities (2026)', null, null, null, null, null, null],
    ['State', 'Localities ', 'Est.pop.2026', 'Births', 'Surviving Infants', 'Under-five', 'Pregnants', 'CBAW'],
    ['W.Darfur', 'Elgenina', 440642, 17185, 15158, 70503, 17185, 106195],
    [null, 'Kerainik', 574982, 22424, 19837, 91997, 22424, 138571],
    [null, 'TOTAL', 1015624, 39609, 34995, 162500, 39609, 244766],
    ['Gezira.', 'South Gezira', 500000, 19500, 17250, 80000, 19500, 120000],
    [null, '(East Gezira)', 400000, 15600, 13800, 64000, 15600, 96000],
    [null, 'Total', 900000, 35100, 31050, 144000, 35100, 216000],
];

describe('parsePopulationRows', () => {
    const result = parsePopulationRows(SHEET, 2026);

    it('finds the header row beneath a title row', () => {
        expect(result.error).toBeUndefined();
        expect(result.columns.state).toBe(0);
        expect(result.columns.locality).toBe(1);
        expect(result.columns.totalPopulation).toBe(2);
    });

    it('carries the merged state down its block', () => {
        const kerainik = result.rows.find((r) => r.localityKey === 'Kereneik');
        expect(kerainik).toBeDefined();
        expect(kerainik.stateKey).toBe('West Darfur');
    });

    it('excludes the per-state subtotal rows', () => {
        expect(result.rows).toHaveLength(4);
        expect(result.skipped.filter((s) => s.reason === 'subtotal row')).toHaveLength(2);
        // The national total must be the sum of localities, not double it.
        const total = result.rows.reduce((sum, r) => sum + r.totalPopulation, 0);
        expect(total).toBe(440642 + 574982 + 500000 + 400000);
    });

    it('maps south and east Gezira the right way round', () => {
        const south = result.rows.find((r) => r.localityKey === 'Janub Al Jazirah');
        const east = result.rows.find((r) => r.localityKey === 'Sharg Al Jazirah');
        expect(south.totalPopulation).toBe(500000);
        expect(east.totalPopulation).toBe(400000);
    });

    it('carries every population field through', () => {
        const genina = result.rows.find((r) => r.localityKey === 'Ag Geneina');
        expect(genina).toMatchObject({
            year: 2026, stateKey: 'West Darfur', births: 17185,
            survivingInfants: 15158, under5: 70503, pregnantWomen: 17185, cbaw: 106195,
        });
    });

    it('reports an unrecognised locality instead of guessing', () => {
        const withUnknown = parsePopulationRows([
            ['State', 'Localities', 'Est.pop.2026'],
            ['Gezira.', 'Somewhere New', 1000],
        ], 2026);
        expect(withUnknown.rows).toHaveLength(0);
        expect(withUnknown.unknown[0]).toMatchObject({
            reason: 'unrecognised locality', locality: 'Somewhere New',
        });
    });

    it('flags a duplicate locality rather than silently overwriting', () => {
        const withDupe = parsePopulationRows([
            ['State', 'Localities', 'Est.pop.2026'],
            ['Gezira.', 'Alhasahisa', 1000],
            [null, 'Alhasahisa', 2000],
        ], 2026);
        expect(withDupe.rows).toHaveLength(1);
        expect(withDupe.duplicates).toHaveLength(1);
    });

    it('errors clearly when the sheet is not a population workbook', () => {
        const bad = parsePopulationRows([['Name', 'Score'], ['x', 1]], 2026);
        expect(bad.error).toMatch(/header row/i);
    });
});

// The workbook puts the assumed share next to every count: "birth percentage"
// beside "Births", "under 5 percentage" beside "Under-five". Matching a share
// column would import 0.039 where 17,185 belongs — a plausible-looking number
// that would be very hard to spot later.
describe('percentage columns are never mapped', () => {
    const SHEET_WITH_RATES = [
        ['State', 'Localities', 'Est.pop.2026', 'birth percentage', 'Births',
            'under 5 percentage', 'Under-five', '5-9 year (13%)', 'total adolscent'],
        ['Gezira.', 'Alhasahisa', 1000000, 0.039, 39000, 0.16, 160000, 130000, 220000],
    ];

    const result = parsePopulationRows(SHEET_WITH_RATES, 2026);

    it('takes the count column, not the share beside it', () => {
        expect(result.rows[0].births).toBe(39000);
        expect(result.rows[0].under5).toBe(160000);
    });

    it('reads the age bands whose header carries the share in brackets', () => {
        expect(result.rows[0].age5to9).toBe(130000);
        expect(result.rows[0].adolescents).toBe(220000);
    });

    it('does not point any field at a percentage header', () => {
        Object.values(result.detected).forEach((header) => {
            if (header) expect(String(header).toLowerCase()).not.toMatch(/percent|rate/);
        });
    });
});

// The template exists so that a file filled in from it always matches. If it
// stops round-tripping, the template is worse than useless — it actively
// teaches the wrong names.
describe('import template round-trips', () => {
    const headerAndRows = buildTemplateRows();

    it('covers every locality in the constants', () => {
        const expected = Object.entries(STATE_LOCALITIES)
            .filter(([key]) => key !== 'Federal')
            .reduce((n, [, s]) => n + (s.localities || []).length, 0);
        expect(headerAndRows.length - 1).toBe(expected);
    });

    it('parses back with nothing unrecognised', () => {
        const filled = headerAndRows.map((row, i) => (
            i === 0 ? row : [row[0], row[1], 1000, 39, 34, 160, 600, 39, 240]
        ));
        const result = parsePopulationRows(filled, 2026);
        expect(result.error).toBeUndefined();
        expect(result.unknown).toEqual([]);
        expect(result.duplicates).toEqual([]);
        expect(result.rows).toHaveLength(headerAndRows.length - 1);
    });
});

// "As Salam / Ar Rawat" in White Nile contains a forward slash. Firestore
// reads that as a path separator, so the whole import was rejected with
// "Document references must have an even number of segments".
describe('population document ids', () => {
    it('strips characters Firestore cannot put in a document id', () => {
        const id = populationTargetId(2026, 'White Nile', 'As Salam / Ar Rawat');
        expect(id).not.toContain('/');
        expect(id.split('/')).toHaveLength(1);
    });

    it('is stable, so re-importing a workbook overwrites instead of doubling', () => {
        expect(populationTargetId(2026, 'Gezira', 'Al Hasahisa'))
            .toBe(populationTargetId(2026, 'Gezira', 'Al Hasahisa'));
    });

    it('keeps a different id for every locality in the country', () => {
        const ids = new Set();
        let count = 0;
        Object.entries(STATE_LOCALITIES).forEach(([stateKey, state]) => {
            (state.localities || []).forEach((l) => {
                ids.add(populationTargetId(2026, stateKey, l.en));
                count += 1;
            });
        });
        expect(ids.size).toBe(count);
    });

    it('separates years', () => {
        expect(populationTargetId(2026, 'Gezira', 'Al Hasahisa'))
            .not.toBe(populationTargetId(2027, 'Gezira', 'Al Hasahisa'));
    });
});

// A row whose name is not recognised still has to carry its numbers, or the
// import screen cannot offer it for correction.
describe('unrecognised rows keep their figures', () => {
    it('attaches the parsed values to an unknown locality', () => {
        const result = parsePopulationRows([
            ['State', 'Localities', 'Est.pop.2026', 'Births', 'Under-five'],
            ['Gezira.', 'Somewhere New', 12345, 481, 1975],
        ], 2026);
        expect(result.rows).toHaveLength(0);
        expect(result.unknown[0].values).toMatchObject({
            year: 2026, totalPopulation: 12345, births: 481, under5: 1975,
        });
        // The state resolved even though the locality did not, so the screen
        // can pre-select the right state in the correction dropdown.
        expect(result.unknown[0].stateKey).toBe('Gezira');
    });
});

describe('locality aliases', () => {
    // Names that are already canonical must resolve to themselves. Without
    // this the alias tables only recognise the *other* spellings, so the
    // template and any file exported from the system fail to import.
    it('accepts canonical names as themselves', () => {
        expect(canonicalState('West Darfur')).toBe('West Darfur');
        expect(canonicalLocality('West Darfur', 'Ag Geneina')).toBe('Ag Geneina');
        expect(canonicalLocality('Gezira', 'Janub Al Jazirah')).toBe('Janub Al Jazirah');
    });

    it('accepts the Arabic names', () => {
        expect(canonicalState('شمال دارفور')).toBe('North Darfur');
        expect(canonicalLocality('Gezira', 'الحصاحيصا')).toBe('Al Hasahisa');
    });

    it('resolves the state spellings used in the workbooks', () => {
        expect(canonicalState('W.Darfur')).toBe('West Darfur');
        expect(canonicalState('Read Sea')).toBe('Red Sea');
        expect(canonicalState('Gezira.')).toBe('Gezira');
        expect(canonicalState('  gezira.  ')).toBe('Gezira');
    });

    it('keeps the confirmed Gedaref mapping the right way round', () => {
        expect(canonicalLocality('Gedaref', 'ElGedarif')).toBe('Madeinat Al Gedaref');
        expect(canonicalLocality('Gedaref', 'MID Gedarif')).toBe('Wasat Al Gedaref');
    });

    it('keeps the confirmed Jabal Marrah mappings', () => {
        expect(canonicalLocality('Central Darfur', 'Golo')).toBe('Wasat Jabal Marrah');
        expect(canonicalLocality('Central Darfur', 'Rokro')).toBe('Shamal Jabal Marrah');
        expect(canonicalLocality('Central Darfur', 'Naertity')).toBe('Gharb Jabal Marrah');
    });

    it('keeps the confirmed Nyala mappings', () => {
        expect(canonicalLocality('South Darfur', 'Nyala')).toBe('Nyala Janoub');
        expect(canonicalLocality('South Darfur', 'Nyala North')).toBe('Nyala Shimal');
        expect(canonicalLocality('South Darfur', 'Elmlam')).toBe('Al Wihda');
    });

    // Every alias must point at a locality that really exists in the
    // constants, or an import writes population under a name nothing reads.
    it('only maps onto localities that exist in STATE_LOCALITIES', () => {
        const offenders = [];
        Object.entries(LOCALITY_ALIASES).forEach(([stateKey, table]) => {
            const known = (STATE_LOCALITIES[stateKey]?.localities || []).map((l) => l.en);
            Object.entries(table).forEach(([sheet, canonical]) => {
                if (!known.includes(canonical)) offenders.push(`${stateKey}: "${sheet}" -> "${canonical}"`);
            });
        });
        expect(offenders).toEqual([]);
    });

    it('never maps two spellings in one state onto the same locality', () => {
        const clashes = [];
        Object.entries(LOCALITY_ALIASES).forEach(([stateKey, table]) => {
            const seen = new Map();
            Object.entries(table).forEach(([sheet, canonical]) => {
                if (seen.has(canonical)) clashes.push(`${stateKey}: "${sheet}" and "${seen.get(canonical)}" both -> "${canonical}"`);
                else seen.set(canonical, sheet);
            });
        });
        expect(clashes).toEqual([]);
    });
});
