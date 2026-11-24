import { describe, it, expect } from 'vitest';
import { isCourseTester, canAccessDraft, isDraftCourse } from '../src/components/imnci/onlineCourses/audience';

describe('draft course testers', () => {
    const draft = { id: 'c1', isPublished: false, testers: ['ahmed@example.org', 'Sara@Example.org'] };
    const published = { id: 'c2', isPublished: true, testers: ['ahmed@example.org'] };

    it('matches a tester by email, ignoring case and spaces', () => {
        expect(isCourseTester(draft, 'ahmed@example.org')).toBe(true);
        expect(isCourseTester(draft, ' AHMED@example.org ')).toBe(true);
        expect(isCourseTester(draft, 'sara@example.org')).toBe(true);
        expect(isCourseTester(draft, 'other@example.org')).toBe(false);
        expect(isCourseTester(draft, '')).toBe(false);
        expect(isCourseTester(draft, null)).toBe(false);
        expect(isCourseTester({ id: 'c3' }, 'ahmed@example.org')).toBe(false);
    });

    it('opens a draft to managers and testers only', () => {
        expect(canAccessDraft(draft, { canManage: true })).toBe(true);
        expect(canAccessDraft(draft, { email: 'ahmed@example.org' })).toBe(true);
        expect(canAccessDraft(draft, { email: 'other@example.org' })).toBe(false);
        expect(canAccessDraft(draft, {})).toBe(false);
    });

    it('treats only an explicit unpublished course as a draft', () => {
        expect(isDraftCourse(draft)).toBe(true);
        expect(isDraftCourse(published)).toBe(false);
        expect(isDraftCourse({ id: 'c9' })).toBe(false);
        expect(canAccessDraft({ id: 'c9', testers: ['ahmed@example.org'] }, { email: 'ahmed@example.org' })).toBe(false);
    });

    it('is not draft access once the course is published', () => {
        expect(canAccessDraft(published, { canManage: true })).toBe(false);
        expect(canAccessDraft(published, { email: 'ahmed@example.org' })).toBe(false);
    });
});
