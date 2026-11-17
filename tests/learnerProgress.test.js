import { describe, it, expect } from 'vitest';
import { learnerSummary, toMillis } from '../src/components/imnci/onlineCourses/learnerProgress';
import { activityKeys } from '../src/components/imnci/onlineCourses/activityKeys';

// =============================================================================
// "My progress": one learner's own course, module and lesson states.
// =============================================================================

const q = (text) => ({ type: 'question', text, options: ['a', 'b'], answer: 0 });
const lesson = (id, moduleId, order, blocks = [{ type: 'text', text: 'Read this.' }]) => ({ id, kind: 'section', courseId: 'c1', moduleId, order, title: id.toUpperCase(), read: blocks });
const items = [
    { id: 'm2', kind: 'module', courseId: 'c1', title: 'Module 2', order: 2 },
    { id: 'm1', kind: 'module', courseId: 'c1', title: 'Module 1', order: 1 },
    lesson('a1', 'm1', 1),
    lesson('a2', 'm1', 2, [q('One?'), q('Two?')]),
    lesson('a3', 'm1', 3),
    lesson('b1', 'm2', 1),
];
const courses = [{ id: 'c1', title: 'IMNCI' }];
const NOW = Date.UTC(2026, 10, 17, 12);
const DAY = 86400000;

describe('learner progress summary', () => {
    it('reads every kind of saved time', () => {
        expect(toMillis(true)).toBe(0);
        expect(toMillis({ seconds: 2 })).toBe(2000);
        expect(toMillis({ toMillis: () => 5 })).toBe(5);
    });

    it('gives each lesson and module its state, locked in order, and the next lesson', () => {
        const keys = activityKeys(items[3].read);
        const s = learnerSummary({ courses, items, now: NOW, progress: {
            completed: { a1: { seconds: (NOW - DAY) / 1000 } },
            activities: { a2: [keys[0]] },
        } });
        const c = s.courses[0];
        expect(c.modules.map((m) => m.id)).toEqual(['m1', 'm2']);
        expect(c.modules[0].lessons.map((l) => l.status)).toEqual(['done', 'started', 'locked']);
        expect(c.modules[0].lessons[1]).toMatchObject({ activities: 2, activitiesDone: 1 });
        expect(c.modules[0].status).toBe('started');
        expect(c.modules[1].status).toBe('locked');
        expect(c.modules[1].lessons[0].status).toBe('locked');
        expect(c.next.id).toBe('a2');
        expect(c).toMatchObject({ done: 1, total: 4, percent: 25, modulesDone: 0, activities: 2, activitiesDone: 1 });
        expect(s.streak).toBe(1);
        expect(s.thisWeek).toBe(1);
    });

    it('opens everything when the course is not read in order, and counts a finished course', () => {
        const open = learnerSummary({ courses: [{ ...courses[0], lockOrder: false }], items, progress: {}, now: NOW });
        expect(open.courses[0].modules.flatMap((m) => m.lessons.map((l) => l.status))).toEqual(['open', 'open', 'open', 'open']);

        const t = (d) => ({ seconds: (NOW - d * DAY) / 1000 });
        const all = learnerSummary({ courses, items, now: NOW, progress: { completed: { a1: t(20), a2: t(2), a3: t(1), b1: t(0) } } });
        expect(all.courses[0]).toMatchObject({ status: 'done', percent: 100, next: null, modulesDone: 2, activitiesDone: 2 });
        expect(all.streak).toBe(3);
        expect(all.weeks.reduce((n, w) => n + w, 0)).toBe(4);
        expect(all.lastActive).toBe(NOW);
    });
});
