// courseForm (src/components/imnci/onlineCourses/courseForm.js): the group
// form's facilitator picker must work from the whole facilitator list, and a
// course must be saveable as a draft with incomplete information.
import { describe, it, expect } from 'vitest';
import { facilitatorMatches, courseSavePayload, normaliseTesterEmails } from '../src/components/imnci/onlineCourses/courseForm';

const FACILITATORS = [
    { id: 'f2', name: 'Zeinab Ahmed', phone: '0902', currentState: 'Khartoum', courses: ['IMNCI'] },
    { id: 'f1', name: 'Ahmed Ali', arabicName: 'أحمد علي', phone: '0901', email: 'ahmed@example.org', currentState: 'Gezira', courses: ['Small & Sick Newborn'] },
    { id: 'f3', name: 'Mona Deleted', isDeleted: true },
    { id: 'f4', name: 'Sara Noor', phone: '0904', currentState: 'Kassala', courses: [] },
];

describe('facilitatorMatches', () => {
    it('with no search text returns the whole list, sorted by name, without deleted facilitators', () => {
        const out = facilitatorMatches(FACILITATORS, '');
        expect(out.map((f) => f.id)).toEqual(['f1', 'f4', 'f2']);
    });

    it('searches name, Arabic name, phone, email, state and courses', () => {
        expect(facilitatorMatches(FACILITATORS, 'gezira').map((f) => f.id)).toEqual(['f1']);
        expect(facilitatorMatches(FACILITATORS, 'أحمد').map((f) => f.id)).toEqual(['f1']);
        expect(facilitatorMatches(FACILITATORS, '0904').map((f) => f.id)).toEqual(['f4']);
        expect(facilitatorMatches(FACILITATORS, 'ahmed@example').map((f) => f.id)).toEqual(['f1']);
        expect(facilitatorMatches(FACILITATORS, 'newborn').map((f) => f.id)).toEqual(['f1']);
        expect(facilitatorMatches(FACILITATORS, 'nobody')).toEqual([]);
    });

    it('never returns deleted facilitators, even when they match the search', () => {
        expect(facilitatorMatches(FACILITATORS, 'mona')).toEqual([]);
    });

    it('respects the limit and tolerates a missing list', () => {
        expect(facilitatorMatches(FACILITATORS, '', 2)).toHaveLength(2);
        expect(facilitatorMatches(null, 'x')).toEqual([]);
        expect(facilitatorMatches(undefined, '')).toEqual([]);
    });
});

describe('courseSavePayload', () => {
    it('a draft with no title yet is saved unpublished under the placeholder title', () => {
        const out = courseSavePayload({ title: '  ', category: '', isPublished: true }, { draft: true, untitled: 'Untitled course (draft)' });
        expect(out.title).toBe('Untitled course (draft)');
        expect(out.isPublished).toBe(false);
    });

    it('a draft keeps whatever information is filled in, trimmed', () => {
        const out = courseSavePayload(
            { title: ' Small & Sick Newborn ', category: ' Small & Sick Newborn ', subcategory: ' Module 1 ', description: 'Draft notes', enrolment: 'open', isPublished: true },
            { draft: true },
        );
        expect(out).toMatchObject({ title: 'Small & Sick Newborn', category: 'Small & Sick Newborn', subcategory: 'Module 1', description: 'Draft notes', enrolment: 'open', isPublished: false });
    });

    it('a normal save passes the form values through, trimmed', () => {
        const out = courseSavePayload({ title: ' IMNCI ', category: 'IMNCI', subcategory: '', isPublished: true });
        expect(out.title).toBe('IMNCI');
        expect(out.isPublished).toBe(true);
    });
});

describe('course testers', () => {
    it('normalises the testers field: split, trimmed, lowercased, deduped, valid emails only', () => {
        expect(normaliseTesterEmails(' Ahmed@Example.org\n sara@example.org, ahmed@example.org; not-an-email '))
            .toEqual(['ahmed@example.org', 'sara@example.org']);
        expect(normaliseTesterEmails(['A@B.ORG', ' a@b.org '])).toEqual(['a@b.org']);
        expect(normaliseTesterEmails('')).toEqual([]);
        expect(normaliseTesterEmails(undefined)).toEqual([]);
    });

    it('saves the normalised testers with the course, draft or not', () => {
        expect(courseSavePayload({ title: 'X', testers: 'A@b.org\nc@d.org' }).testers).toEqual(['a@b.org', 'c@d.org']);
        expect(courseSavePayload({ title: 'X' }).testers).toEqual([]);
        expect(courseSavePayload({ title: '', testers: 'a@b.org' }, { draft: true }).testers).toEqual(['a@b.org']);
    });
});
