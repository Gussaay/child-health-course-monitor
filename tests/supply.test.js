import { describe, it, expect } from 'vitest';
import {
    parseSupplyRows, emptySupplyItem, annualNeed,
    SUPPLY_CATEGORIES, CASELOAD_CATEGORIES,
} from '../src/components/SupplyManagementView';

const SHEET = [
    ['Category', 'Service', 'Item name', 'Name (Arabic)', 'Code', 'Strength', 'Form', 'Unit'],
    ['Drugs & Medicines', 'IMNCI', 'Amoxicillin DT', 'أموكسيسيلين', 'AMX', '250 mg', 'Tablet', 'Tablet'],
    ['consumables', 'IMNCI', 'Malaria RDT', '', 'RDT01', '', '', 'Piece'],
    ['المستهلكات', 'ETAT', 'Gloves', 'قفازات', 'GLV', '', '', 'Pack'],
    ['Equipment & Devices', 'ETAT', 'Pulse oximeter', '', 'EQ', '', '', 'Piece'],
];

describe('essential list import', () => {
    const result = parseSupplyRows(SHEET);

    it('accepts the category as an id, an English label or an Arabic label', () => {
        expect(result.error).toBeUndefined();
        expect(result.rows.map((r) => r.category))
            .toEqual(['drugs', 'consumables', 'consumables', 'equipment']);
    });

    it('carries the optional columns through', () => {
        expect(result.rows[0]).toMatchObject({
            name: 'Amoxicillin DT', nameAr: 'أموكسيسيلين',
            code: 'AMX', strength: '250 mg', form: 'Tablet', unit: 'Tablet',
        });
    });

    it('skips a row whose category or service is not recognised', () => {
        const r = parseSupplyRows([
            ...SHEET,
            ['Nonsense', 'IMNCI', 'Bad category', '', '', '', '', ''],
            ['Drugs & Medicines', 'NOT_A_SERVICE', 'Bad service', '', '', '', '', ''],
        ]);
        expect(r.rows).toHaveLength(4);
        expect(r.unknown.map((u) => u.reason))
            .toEqual(['unrecognised category', 'unrecognised service']);
    });

    it('reports a repeated item rather than silently collapsing it', () => {
        const r = parseSupplyRows([...SHEET,
            ['Drugs & Medicines', 'IMNCI', 'Amoxicillin DT', '', '', '', '', '']]);
        expect(r.rows).toHaveLength(4);
        expect(r.duplicates).toHaveLength(1);
    });

    it('errors clearly when the sheet has no item-name column', () => {
        expect(parseSupplyRows([['A', 'B'], ['x', 'y']]).error).toMatch(/item name/i);
    });
});

describe('quantification defaults by category', () => {
    // Consumables scale with how many children are seen; equipment scales with
    // the number of service points. Defaulting a consumable to per-facility
    // would under-order every high-caseload locality in the country.
    it('gives caseload categories a cohort basis', () => {
        CASELOAD_CATEGORIES.forEach((id) => {
            expect(emptySupplyItem(id).quantification.targetCohort).toBe('under_5');
        });
    });

    it('gives the other categories a per-facility basis', () => {
        SUPPLY_CATEGORIES
            .filter((c) => !CASELOAD_CATEGORIES.includes(c.id))
            .forEach((c) => {
                expect(emptySupplyItem(c.id).quantification.targetCohort).toBe('per_facility');
            });
    });

    it('imports items ready to quantify without any further input', () => {
        const [drug] = parseSupplyRows(SHEET).rows;
        expect(annualNeed(drug.quantification, 100000, null)).not.toBeNull();
    });
});

describe('annualNeed', () => {
    it('applies incidence, reach, courses, wastage and buffer in order', () => {
        // 100,000 under-5s × 500/1000 × 80% = 40,000 cases
        // × 1 course × 10 units = 400,000 × 1.10 wastage × 1.25 buffer
        const need = annualNeed({
            targetCohort: 'under_5', incidencePer1000: 500, attendanceRatePercent: 80,
            coursesPerCase: 1, unitsPerCourse: 10, wastagePercent: 10,
            bufferPercent: 25, reviewPeriodMonths: 12,
        }, 100000, null);
        expect(Math.round(need)).toBe(550000);
    });

    it('returns null rather than zero when the population is unknown', () => {
        expect(annualNeed({ targetCohort: 'under_5' }, null, null)).toBeNull();
    });

    it('uses the facility count for per-facility items', () => {
        expect(annualNeed({
            targetCohort: 'per_facility', quantityPerFacility: 2,
            wastagePercent: 0, bufferPercent: 0, reviewPeriodMonths: 12,
        }, null, 50)).toBe(100);
    });
});
