import { describe, it, expect } from 'vitest';
import { RECYCLE_BIN_TYPES, recycleBinType, recordTitle, recordSubtitle, mergeRemovals } from '../src/utils/recycleBin.js';

describe('recycle bin registry', () => {
    it('lists each collection once', () => {
        const names = RECYCLE_BIN_TYPES.map((t) => t.collection);
        expect(new Set(names).size).toBe(names.length);
    });

    it('takes a course\'s participants, monitoring, reports and tests with it', () => {
        const children = recycleBinType('courses').children.map((c) => c.collection);
        expect(children).toEqual(expect.arrayContaining(['participants', 'observations', 'cases', 'finalReports', 'participantTests']));
    });

    it('knows nothing about collections it does not cover', () => {
        expect(recycleBinType('users')).toBeNull();
    });
});

describe('record titles', () => {
    it('uses the best name the record has', () => {
        expect(recordTitle({ id: 'x', name: 'Amna' })).toBe('Amna');
        expect(recordTitle({ id: 'x', course_type: 'IMNCI', state: 'Kassala', locality: 'Halfa' })).toBe('IMNCI - Kassala - Halfa');
        expect(recordTitle({ id: 'x', 'اسم_المؤسسة': 'مركز' })).toBe('مركز');
        expect(recordTitle({ id: 'only-id' })).toBe('only-id');
    });

    it('describes where and when', () => {
        expect(recordSubtitle({ phone: '0911', state: 'Kassala', locality: 'Halfa', date: '2026-01-02' }))
            .toBe('0911 · Kassala / Halfa · 2026-01-02');
    });
});

describe('mergeRemovals', () => {
    it('combines ids per cache without duplicates', () => {
        expect(mergeRemovals({ participants: ['a'] }, { participants: ['a', 'b'], courses: ['c'] }, undefined))
            .toEqual({ participants: ['a', 'b'], courses: ['c'] });
    });
});
