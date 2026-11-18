import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// =============================================================================
// Managers' online course progress: who started and finished which course.
// =============================================================================

const require = createRequire(import.meta.url);
const { buildReport, courseTotals, placeTotals, progressForModel } = require('../functions/onlineProgressReport.js');

const courses = [{ id: 'c1', title: 'IMNCI online' }, { id: 'c2', title: 'Draft', isPublished: false }];
const items = [
    { id: 's1', kind: 'section', courseId: 'c1' }, { id: 's2', kind: 'section', courseId: 'c1' },
    { id: 'm1', kind: 'module', courseId: 'c1' }, { id: 's9', kind: 'section', courseId: 'c2' },
];
const users = [
    { id: 'u1', displayName: 'Amna', assignedState: 'Kassala', assignedLocality: 'Kassala', role: 'user' },
    { id: 'u2', displayName: 'Badr', assignedState: 'Kassala', assignedLocality: 'Aroma', role: 'user' },
    { id: 'u3', displayName: 'Hiba', assignedState: 'Sennar', assignedLocality: 'Sinja', role: 'user' },
];
const progress = [
    { id: 'u1', completed: { s1: { _seconds: 1790000000 }, s2: { _seconds: 1790000100 } } },
    { id: 'u2', completed: { s1: { _seconds: 1790000000 } } },
];
const report = (caller) => buildReport({ caller, courses, items, progress, users });

describe('online course progress report', () => {
    it('is for managers only, and a state manager sees only their state', () => {
        expect(report({ role: 'user' })).toBeNull();
        expect(report({ roles: ['federal_manager'] }).learners).toHaveLength(3);
        expect(report({ role: 'states_manager', assignedState: 'kassala' }).learners.map((l) => l.name)).toEqual(['Amna', 'Badr']);
        expect(report({ role: 'locality_manager', assignedLocality: 'Aroma' }).learners.map((l) => l.name)).toEqual(['Badr']);
    });

    it('counts sections of published courses only, and lists people who have not started', () => {
        const r = report({ role: 'super_user' });
        expect(r.courses.map(({ id, title, sections }) => ({ id, title, sections }))).toEqual([{ id: 'c1', title: 'IMNCI online', sections: 2 }]);
        expect(r.learners.find((l) => l.uid === 'u3').perCourse).toEqual({});
        expect(courseTotals(r)).toEqual([{ course: 'IMNCI online', sections: 2, people: 3, started: 2, completed: 1, averagePercentDone: 75 }]);
        expect(placeTotals(r)).toEqual([
            { state: 'Kassala', people: 2, started: 2, completed: 1 },
            { state: 'Sennar', people: 1, started: 0, completed: 0 },
        ]);
    });

    it('gives the assistant people by status within its budget', () => {
        const out = progressForModel(report({ role: 'super_user' }), { people: true, status: 'not_started' });
        expect(out.people.map((p) => p.name)).toEqual(['Hiba']);
        expect(progressForModel(report({ role: 'super_user' }), { people: true }, 300).peopleNotShown).toBeGreaterThan(0);
    });

    it('breaks a course into modules and lessons, in reading order, and shows where each learner is', () => {
        const its = [
            { id: 'mB', kind: 'module', courseId: 'c1', title: 'Module 2', order: 2 },
            { id: 'mA', kind: 'module', courseId: 'c1', title: 'Module 1', order: 1 },
            { id: 'b1', kind: 'section', courseId: 'c1', moduleId: 'mB', title: 'B1', order: 1 },
            { id: 'a2', kind: 'section', courseId: 'c1', moduleId: 'mA', title: 'A2', order: 2 },
            { id: 'a1', kind: 'section', courseId: 'c1', moduleId: 'mA', title: 'A1', order: 1 },
            { id: 'gone', kind: 'section', courseId: 'c1', moduleId: 'mA', title: 'X', order: 3, isDeleted: true },
        ];
        const prog = [
            { id: 'u1', completed: { a1: { _seconds: 1790000000 } }, activities: { a2: ['quiz-1'] }, lastUpdatedAt: { _seconds: 1790000500 } },
            { id: 'u2', completed: { a1: { _seconds: 1790000000 }, a2: { _seconds: 1790000100 }, b1: { _seconds: 1790000200 } } },
        ];
        const r = buildReport({ caller: { role: 'super_user' }, courses, items: its, progress: prog, users });
        const c = r.courses[0];
        expect(c.lessons.map((l) => l.id)).toEqual(['a1', 'a2', 'b1']);
        expect(c.modules).toEqual([{ id: 'mA', title: 'Module 1', sections: 2, ratingSum: 0, ratings: 0 }, { id: 'mB', title: 'Module 2', sections: 1, ratingSum: 0, ratings: 0 }]);
        expect(c.lessons.map((l) => [l.done, l.started])).toEqual([[2, 0], [1, 1], [1, 0]]);
        const amna = r.learners.find((l) => l.uid === 'u1');
        expect(amna.perModule).toEqual({ mA: 1 });
        expect(amna.startedPerCourse).toEqual({ c1: 1 });
        expect(amna.at).toEqual({ c1: 'a2' });
        expect(amna.lastActive).toBe(1790000500 * 1000);
        const badr = r.learners.find((l) => l.uid === 'u2');
        expect(badr.perCourse).toEqual({ c1: 3 });
        expect(badr.at).toEqual({});
        expect(r.learners.find((l) => l.uid === 'u3').at).toEqual({});
    });
});
