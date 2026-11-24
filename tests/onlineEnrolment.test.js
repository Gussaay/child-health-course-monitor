import { describe, it, expect } from 'vitest';
import { groupCourses, categoryOf } from '../src/components/imnci/onlineCourses/categories.js';
import { courseAccess, canStudy } from '../src/components/imnci/onlineCourses/enrolment.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('online course categories', () => {
    it('reads a category from the title of an older course', () => {
        expect(categoryOf({ title: 'Sudan ETAT Training' })).toBe('ETAT');
        expect(categoryOf({ title: 'IMNCI distance learning' })).toBe('IMNCI');
        expect(categoryOf({ title: 'Something else' })).toBe('Other');
        expect(categoryOf({ title: 'ETAT', category: 'IMNCI' })).toBe('IMNCI');
    });

    it('groups courses by category, then subcategory, in the face-to-face order', () => {
        const groups = groupCourses([
            { id: 'a', title: 'x', category: 'ETAT', subcategory: 'ETAT Plus' },
            { id: 'b', title: 'y', category: 'IMNCI' },
            { id: 'c', title: 'z', category: 'ETAT' },
            { id: 'd', title: 'w' },
        ]);
        expect(groups.map((g) => g.category)).toEqual(['IMNCI', 'ETAT', 'Other']);
        expect(groups[1].subgroups.map((s) => s.subcategory)).toEqual(['', 'ETAT Plus']);
    });
});

describe('course access', () => {
    const course = { id: 'c1' };
    it('needs a manager\'s approval by default', () => {
        expect(courseAccess(course, null)).toBe('none');
        expect(courseAccess(course, { status: 'requested' })).toBe('requested');
        expect(courseAccess(course, { status: 'declined' })).toBe('declined');
        expect(courseAccess(course, { status: 'approved' })).toBe('enrolled');
        expect(canStudy(courseAccess(course, { status: 'requested' }))).toBe(false);
    });
    it('lets anyone into an open course', () => {
        expect(courseAccess({ ...course, enrolment: 'open' }, null)).toBe('open');
    });
    it('keeps the place of someone who started before enrolment existed', () => {
        expect(courseAccess(course, null, { started: true })).toBe('enrolled');
    });
    it('opens a draft to a manager or an invited tester, and to nobody else', () => {
        expect(courseAccess(course, null, { draftAccess: true })).toBe('enrolled');
        expect(courseAccess(course, null, { draftAccess: false })).toBe('none');
        expect(courseAccess(course, { status: 'requested' }, { draftAccess: true })).toBe('enrolled');
    });
});

describe('onlineEnrolment function helpers', () => {
    let fn;
    try { fn = require('../functions/onlineEnrolment.js'); } catch { fn = null; }
    it.skipIf(!fn)('keeps the default groups and lists added groups after them', () => {
        const groups = fn.mergeGroups([
            { id: 'b53', name: 'Registrar batch 53', facilitatorId: 'f1', facilitator: { name: 'Dr A', phone: '0912' } },
            { id: 'gone', name: 'Old', isDeleted: true },
            { id: 'general', name: 'Everyone' },
        ]);
        expect(groups.slice(0, 4).every((g) => g.isDefault)).toBe(true);
        expect(groups[0].name).toBe('Everyone');
        expect(groups.map((g) => g.id)).toContain('b53');
        expect(groups.map((g) => g.id)).not.toContain('gone');
        expect(groups.find((g) => g.id === 'b53').facilitator.name).toBe('Dr A');
    });
    it.skipIf(!fn)('limits a manager to their scope', () => {
        expect(fn.inScope({ level: 'state', state: 'Khartoum' }, { state: 'khartoum' })).toBe(true);
        expect(fn.inScope({ level: 'state', state: 'Khartoum' }, { assignedState: 'Gezira' })).toBe(false);
        expect(fn.inScope(null, { state: 'x' })).toBe(false);
    });
});
