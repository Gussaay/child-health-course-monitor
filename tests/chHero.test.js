// tests/chHero.test.js
//
// The ch-sudan home hero's maths (chHero.js): overall progress, finished
// courses, and which course the Continue button resumes.
import { describe, it, expect } from 'vitest';
import { greetingKey, heroStats } from '../src/components/imnci/onlineCourses/chHero';

describe('greetingKey', () => {
    it('greets by local time', () => {
        expect(greetingKey(new Date(2026, 0, 1, 8, 30))).toBe('greeting_morning');
        expect(greetingKey(new Date(2026, 0, 1, 11, 59))).toBe('greeting_morning');
        expect(greetingKey(new Date(2026, 0, 1, 12, 0))).toBe('greeting_evening');
        expect(greetingKey(new Date(2026, 0, 1, 23, 15))).toBe('greeting_evening');
    });
});

describe('heroStats', () => {
    it('handles an empty summary', () => {
        const s = heroStats(null);
        expect(s.pct).toBe(0);
        expect(s.lessonsDone).toBe(0);
        expect(s.coursesDone).toBe(0);
        expect(s.continueCourse).toBeNull();
        expect(heroStats({}).pct).toBe(0);
    });

    it('computes the overall percentage and finished courses', () => {
        const s = heroStats({
            lessonsDone: 30, lessonsTotal: 40, activitiesDone: 12, activities: 20,
            thisWeek: 3, streak: 5,
            courses: [
                { id: 'a', percent: 100, status: 'done' },
                { id: 'b', percent: 45, status: 'started', next: { id: 's9', moduleId: 'm2' } },
            ],
        });
        expect(s.pct).toBe(75);
        expect(s.coursesDone).toBe(1);
        expect(s.thisWeek).toBe(3);
        expect(s.streak).toBe(5);
    });

    it('resumes a started course before an untouched one', () => {
        const open = { id: 'open1', percent: 0, status: 'open', next: { id: 's1', moduleId: 'm1' } };
        const started = { id: 'mid', percent: 45, status: 'started', next: { id: 's9', moduleId: 'm2' } };
        expect(heroStats({ courses: [open, started] }).continueCourse).toBe(started);
        expect(heroStats({ courses: [open] }).continueCourse).toBe(open);
    });

    it('offers no continue course when everything is done or locked away', () => {
        const done = { id: 'a', percent: 100, status: 'done' };
        const noNext = { id: 'b', percent: 0, status: 'open', next: null };
        expect(heroStats({ courses: [done] }).continueCourse).toBeNull();
        expect(heroStats({ courses: [noNext] }).continueCourse).toBeNull();
    });
});
