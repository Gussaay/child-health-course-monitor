import { describe, it, expect } from 'vitest';
import { AREAS, areaOf, coursesByArea } from '../src/components/imnci/onlineCourses/areas';

// The Online Courses page opens with the programme areas, each a tile with its
// icon and full name.
describe('course areas', () => {
    it('are IMNCI, ETAT, Newborn, Adolescent and Program Management', () => {
        expect(AREAS.map((a) => a.short)).toEqual(['IMNCI', 'ETAT', 'Newborn', 'Adolescent', 'Program Management']);
        AREAS.forEach((a) => { expect(a.icon).toBeTruthy(); expect(a.full.length).toBeGreaterThan(5); });
    });

    it('put each course in its area, the newborn packages together', () => {
        expect(areaOf({ category: 'Small & Sick Newborn' }).id).toBe('newborn');
        expect(areaOf({ category: 'EmONC' }).id).toBe('newborn');
        expect(areaOf({ title: 'Sudan ETAT Training' }).id).toBe('etat');
        expect(areaOf({ title: 'Adolescent health basics', category: 'Other' }).id).toBe('adolescent');
        expect(areaOf({ category: 'IPC' }).id).toBe('other');
    });

    it('list every main area, and Other only when it has courses', () => {
        expect(coursesByArea([{ category: 'IMNCI' }]).map((x) => x.area.id)).toEqual(['imnci', 'etat', 'newborn', 'adolescent', 'program']);
        expect(coursesByArea([{ category: 'IPC' }]).map((x) => x.area.id)).toContain('other');
    });
});
