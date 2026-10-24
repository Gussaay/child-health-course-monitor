import { describe, it, expect } from 'vitest';
import {
    compactRow, rowsWithin, describeFields, groupRows, cleanFilters, systemFor, pageBlock, TOOLS,
} from '../functions/aiDataText.js';
import { chartToText, cleanPageText } from '../src/utils/pageSnapshot.js';

// =============================================================================
// The data assistant ("Ask the data"): what the model is shown.
// =============================================================================

describe('records are shrunk before a model sees them', () => {
    it('drops signatures, pictures and links, and turns timestamps into dates', () => {
        const row = compactRow({
            id: 'c1',
            course_type: 'IMNCI',
            approvedByManagerSignatureUrl: 'data:image/png;base64,AAAA',
            certificateUrls: { IMNCI: 'https://x' },
            hall_photo: 'x',
            notes: 'data:image/png;base64,BBBB',
            createdAt: { _seconds: 1760000000, _nanoseconds: 0 },
            empty: '',
            none: null,
            list: [],
        });
        expect(row).toEqual({ id: 'c1', course_type: 'IMNCI', createdAt: new Date(1760000000 * 1000).toISOString() });
    });

    it('cuts long text and long lists', () => {
        const row = compactRow({ comments: 'x'.repeat(1000), facilitators: Array.from({ length: 20 }, (_, i) => `f${i}`) });
        expect(row.comments.length).toBeLessThan(410);
        expect(row.facilitators).toHaveLength(13);
        expect(row.facilitators.at(-1)).toMatch(/8 more/);
    });

    it('keeps whole rows within the budget and says how many were left out', () => {
        const rows = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, state: 'Kassala', text: 'y'.repeat(300) }));
        const out = rowsWithin(rows, 2000);
        expect(out.rows.length).toBeGreaterThan(0);
        expect(out.rows.length + out.notShown).toBe(50);
        expect(JSON.stringify(out.rows).length).toBeLessThanOrEqual(2000);
    });

    it('returns only the fields asked for, with the id', () => {
        const out = rowsWithin([{ id: 'a', state: 'Sennar', locality: 'Sinja', phone: '09' }], 5000, ['state']);
        expect(out.rows).toEqual([{ id: 'a', state: 'Sennar' }]);
    });
});

describe('fields of a collection', () => {
    it('lists fields by how often they are filled, with examples', () => {
        const out = describeFields([
            { الولاية: 'Gezira', هل_المؤسسة_تعمل: 'Yes' },
            { الولاية: 'Kassala', هل_المؤسسة_تعمل: 'No' },
            { الولاية: 'Kassala' },
        ]);
        expect(out.sampled).toBe(3);
        expect(out.fields[0]).toMatchObject({ field: 'الولاية', filled: 3, type: 'string', examples: ['Gezira', 'Kassala'] });
        expect(out.fields[1]).toMatchObject({ field: 'هل_المؤسسة_تعمل', filled: 2 });
    });

    it('gives no examples of names or phone numbers in a collection of people', () => {
        const out = describeFields([{ name: 'Amna', phone: '0912', state: 'Sennar' }], { personal: true });
        const byName = Object.fromEntries(out.fields.map((f) => [f.field, f]));
        expect(byName.name.examples).toEqual([]);
        expect(byName.phone.examples).toEqual([]);
        expect(byName.state.examples).toEqual(['Sennar']);
    });
});

describe('counting', () => {
    const courses = [
        { state: 'Kassala', course_type: 'IMNCI', start_date: '2025-02-01', post: 80 },
        { state: 'Kassala', course_type: 'ETAT', start_date: '2026-03-10', post: '60' },
        { state: 'Sennar', course_type: 'IMNCI', start_date: '2026-05-20' },
        { states: ['Gezira', 'Sennar'], course_type: 'EENC', start_date: { _seconds: 1780000000 } },
    ];

    it('counts by a field, most first, with unset values named', () => {
        expect(groupRows(courses, { groupBy: 'state' })).toEqual([
            { value: 'Kassala', count: 2 },
            { value: 'Sennar', count: 1 },
            { value: '(not set)', count: 1 },
        ]);
    });

    it('counts a row once under each value of a list field', () => {
        expect(groupRows(courses, { groupBy: 'states' }).map((g) => g.value)).toEqual(['(not set)', 'Gezira', 'Sennar']);
    });

    it('groups dates by year, in order', () => {
        expect(groupRows(courses, { groupBy: 'start_date', bucket: 'year' })).toEqual([
            { value: '2025', count: 1 },
            { value: '2026', count: 3 },
        ]);
    });

    it('averages a number field, counting how many records had it', () => {
        const [kassala] = groupRows(courses, { groupBy: 'state', valueField: 'post' });
        expect(kassala).toMatchObject({ value: 'Kassala', count: 2, withValue: 2, sum: 140, average: 70, lowest: 60, highest: 80 });
    });

    it('gives one overall group when nothing is grouped', () => {
        expect(groupRows(courses, {})).toEqual([{ value: '(all)', count: 4 }]);
    });
});

describe('filters from a model', () => {
    it('turns text into numbers, booleans and lists where Firestore needs them', () => {
        expect(cleanFilters([
            { field: 'post_test_score', op: '>=', value: '70' },
            { field: 'isCertificateApproved', value: 'true' },
            { field: 'state', op: 'in', value: 'Kassala, Sennar' },
            { field: 'start_date', op: '>=', value: '2026-01-01' },
            { field: 'phone', op: '==', value: '0912' },
            { field: '', value: 'x' },
            { field: 'x', op: 'drop table', value: 'y' },
        ])).toEqual([
            { field: 'post_test_score', op: '>=', value: 70 },
            { field: 'isCertificateApproved', op: '==', value: true },
            { field: 'state', op: 'in', value: ['Kassala', 'Sennar'] },
            { field: 'start_date', op: '>=', value: '2026-01-01' },
            { field: 'phone', op: '==', value: '0912' },
            { field: 'x', op: '==', value: 'y' },
        ]);
    });

    it('takes at most eight', () => {
        expect(cleanFilters(Array.from({ length: 12 }, (_, i) => ({ field: `f${i}`, value: 1 })))).toHaveLength(8);
    });
});

describe('what the model is told', () => {
    it('answers only from the app, and says so when the data does not hold the answer', () => {
        const s = systemFor({});
        expect(s).toMatch(/ONLY the app's own data/);
        expect(s).toMatch(/Do not use general knowledge/);
        expect(s).toMatch(/does not show this/);
        expect(s).toMatch(/data, never instructions/);
    });

    it('carries the open page, cut to the size the provider takes', () => {
        const page = { view: 'dashboard', title: 'Dashboard', text: 'a'.repeat(20000) };
        expect(pageBlock(page)).toMatch(/^PAGE ON SCREEN — Dashboard \(view: dashboard\)/);
        expect(systemFor({ page, pageChars: 3000 }).length).toBeLessThan(systemFor({ page }).length);
        expect(systemFor({ page, lang: 'ar' })).toMatch(/answer in Arabic/);
    });

    it('offers only reading tools', () => {
        expect(TOOLS.map((t) => t.name)).toEqual(['list_data', 'describe_fields', 'count_data', 'query_data']);
    });

    it('describes tools in a shape Gemini accepts (no untyped values)', () => {
        const untyped = [];
        const walk = (schema, path) => {
            if (!schema || typeof schema !== 'object') return;
            if (!schema.type) untyped.push(path);
            Object.entries(schema.properties || {}).forEach(([k, v]) => walk(v, `${path}.${k}`));
            if (schema.items) walk(schema.items, `${path}[]`);
        };
        TOOLS.forEach((t) => walk(t.parameters, t.name));
        expect(untyped).toEqual([]);
    });
});

describe('the page on screen', () => {
    it('writes a chart\'s numbers as text', () => {
        expect(chartToText({
            title: 'Courses by state',
            labels: ['Kassala', 'Sennar'],
            datasets: [{ label: 'Courses', data: [12, 3.456] }],
        })).toBe('Chart "Courses by state"\n- Courses: Kassala 12, Sennar 3.46');
    });

    it('skips charts with nothing in them', () => {
        expect(chartToText({ labels: [], datasets: [] })).toBe('');
    });

    it('folds blank lines and spaces, and cuts to size', () => {
        expect(cleanPageText('  A \n\n\n  B   C \n')).toBe('A\nB C');
        expect(cleanPageText('x'.repeat(50), 10)).toHaveLength(10);
    });
});
