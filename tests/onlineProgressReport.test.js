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
        expect(r.courses).toEqual([{ id: 'c1', title: 'IMNCI online', sections: 2 }]);
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
});
