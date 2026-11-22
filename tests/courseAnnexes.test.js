import { describe, it, expect } from 'vitest';
import { serviceAnnexes } from '../src/components/imnci/CourseAnnexes';
import { canSeeCourse, isCourseAnnex } from '../src/components/imnci/onlineCourses/audience';
import { kindOf, newElement, elementInfo } from '../src/components/imnci/onlineCourses/editor/elements';

// Annexes (SOPs, skill checklists, chart booklet pages) are kept per service in
// Protocol & Course Management, never listed as a course, and opened from any
// course's lessons with a button.
describe('course annexes', () => {
    const courses = [
        { id: 'a', title: 'SSN annexes', audience: 'annex', category: 'Small & Sick Newborn' },
        { id: 'b', title: 'SSN M1', category: 'Small & Sick Newborn' },
        { id: 'c', title: 'ETAT annexes', audience: 'annex', category: 'ETAT' },
        { id: 'd', title: 'old', audience: 'annex', category: 'ETAT', isDeleted: true },
    ];

    it('are listed by service', () => {
        expect(serviceAnnexes(courses, 'Small & Sick Newborn').map((c) => c.id)).toEqual(['a']);
        expect(serviceAnnexes(courses, 'ETAT').map((c) => c.id)).toEqual(['c']);
    });

    it('never appear in a learner\'s course list', () => {
        expect(isCourseAnnex(courses[0])).toBe(true);
        expect(canSeeCourse(courses[0], {})).toBe(false);
        expect(canSeeCourse(courses[1], {})).toBe(true);
    });

    it('are added to a lesson as an "Annex" button that opens the page over the lesson', () => {
        const b = newElement('annex');
        expect(b).toMatchObject({ type: 'courselink', popup: true });
        expect(kindOf(b)).toBe('annex');
        expect(elementInfo(b).name).toMatch(/Annex/);
        expect(kindOf({ type: 'courselink', course: 'x', module: 1 })).toBe('courselink');
    });
});
