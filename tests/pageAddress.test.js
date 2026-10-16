import { describe, expect, it } from 'vitest';
import { describePage, isNewEntry, isTransientPage, pageFromLocation, pagePath, settlePage } from '../src/utils/pageAddress';

const url = (page) => {
    const { path, params } = pagePath(page);
    const q = params.toString();
    return q ? `${path}?${q}` : path;
};

describe('page addresses', () => {
    it('gives each page its own address and reads it back', () => {
        const pages = [
            { view: 'landing' },
            { view: 'dashboard' },
            { view: 'courses', tab: 'courses', type: 'IMNCI' },
            { view: 'courses', tab: 'participants', course: 'c1', type: 'IMNCI' },
            { view: 'humanResources', tab: 'facilitators' },
            { view: 'humanResources', tab: 'programTeams' },
            { view: 'courseReport', course: 'c1' },
            { view: 'participantReport', course: 'c1', participant: 'p1' },
            { view: 'facilitatorReport', facilitator: 'f1' },
            { view: 'planning' },
        ];
        for (const page of pages) {
            const [path, search = ''] = url(page).split('?');
            expect(pageFromLocation(path, search)).toEqual(page);
        }
        expect(url({ view: 'courses', tab: 'participants', course: 'c1' })).toBe('/courses/participants?course=c1');
        expect(url({ view: 'landing' })).toBe('/');
    });

    it('never claims a public link', () => {
        for (const path of [
            '/public/projects', '/public/report/course/x', '/monitor/course/x', '/facilities/data-entry/new',
            '/verify/certificate/x', '/mentorship/submit/IMNCI', '/attendance/course/x', '/mcp', '/oauth/authorize', '/assets/x.js',
        ]) {
            expect(pageFromLocation(path, '')).toBeNull();
        }
    });

    it('reopens a half-filled form as its parent page', () => {
        expect(isTransientPage({ view: 'facilitatorForm' })).toBe(true);
        expect(settlePage({ view: 'finalReport', course: 'c1' })).toEqual({ view: 'courseReport', course: 'c1' });
        expect(settlePage({ view: 'courses', tab: 'edit-course' })).toEqual({ view: 'courses', tab: 'courses' });
        expect(settlePage({ view: 'dashboard' })).toEqual({ view: 'dashboard' });
    });

    it('adds a history entry for a new page but not for a participant change', () => {
        const a = describePage({ view: 'courses', coursesTab: 'participants', courseId: 'c1', participantId: 'p1' });
        const b = describePage({ view: 'courses', coursesTab: 'participants', courseId: 'c1', participantId: 'p2' });
        expect(isNewEntry(a, b)).toBe(false);
        expect(isNewEntry(a, { ...a, course: 'c2' })).toBe(true);
        expect(isNewEntry(a, { view: 'dashboard' })).toBe(true);
    });
});
