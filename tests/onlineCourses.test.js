import { describe, it, expect } from 'vitest';
import { placeFromSearch, searchForPlace, placeDepth, placeUp } from '../src/components/imnci/onlineCourses/place';
import { searchSections, sectionText, fold } from '../src/components/imnci/onlineCourses/search';
import { buildMigration } from '../src/components/imnci/courses';

describe('the learner\'s place in the address', () => {
    it('reads a section with its tab', () => {
        const p = placeFromSearch('?oc=c1&mod=m1&sec=s1&tab=see');
        expect(p).toMatchObject({ course: 'c1', module: 'm1', section: 's1', tab: 'see', book: null });
        expect(placeDepth(p)).toBe(3);
    });

    it('ignores a section or module with no course, and an unknown tab', () => {
        expect(placeFromSearch('?mod=m1&sec=s1').course).toBeNull();
        expect(placeFromSearch('?oc=c1&sec=s1').section).toBeNull();
        expect(placeFromSearch('?oc=c1&mod=m1&sec=s1&tab=test').tab).toBe('read');
    });

    it('writes a place back, keeping other keys and leaving out the default tab', () => {
        const q = searchForPlace({ course: 'c1', module: 'm1', section: 's1', tab: 'read', book: null }, 'course=x&plan=7');
        const params = new URLSearchParams(q);
        expect(params.get('oc')).toBe('c1');
        expect(params.get('sec')).toBe('s1');
        expect(params.has('tab')).toBe(false);
        expect(params.get('course')).toBe('x');
        expect(params.get('plan')).toBe('7');
    });

    it('round-trips a book page', () => {
        const q = searchForPlace({ course: 'c1', module: null, section: null, tab: 'read', book: 'b9' });
        expect(placeFromSearch(q)).toMatchObject({ course: 'c1', book: 'b9' });
        expect(placeDepth(placeFromSearch(q))).toBe(2);
    });

    it('steps out one level at a time', () => {
        let p = placeFromSearch('?oc=c1&mod=m1&sec=s1&tab=see');
        p = placeUp(p); expect(p).toMatchObject({ module: 'm1', section: null, tab: 'read' });
        p = placeUp(p); expect(p).toMatchObject({ course: 'c1', module: null });
        p = placeUp(p); expect(p.course).toBeNull();
    });

    it('steps from a section outside any module straight to the course', () => {
        expect(placeUp({ course: 'c1', module: '__none__', section: 's1', tab: 'read', book: null }).module).toBeNull();
    });
});

const SECTIONS = [
    {
        id: 'a', title: '2.0 Check for general danger signs',
        read: [{ type: 'paragraph', text: 'Ask: is the child able to drink or breastfeed?' }],
    },
    {
        id: 'b', title: '3.1 Cough or difficult breathing',
        read: [
            { type: 'rich', text: '<p>Count the breaths in one minute.</p><p>Fast breathing is <strong>50 breaths</strong> per minute or more.</p>' },
        ],
        see: [{ type: 'table', rows: [{ cells: ['Chest indrawing', 'SEVERE PNEUMONIA'] }] }],
    },
    {
        id: 'c', title: '3.2 Classify fast breathing',
        read: [{ type: 'list', items: ['Fast breathing: PNEUMONIA'] }],
    },
    { id: 'd', title: 'السعال', read: [{ type: 'paragraph', text: 'التنفس السريع عند الأطفال' }] },
];

describe('searching a course', () => {
    it('reads text out of every kind of block', () => {
        const text = sectionText(SECTIONS[1]);
        expect(text).toContain('50 breaths');
        expect(text).toContain('SEVERE PNEUMONIA');
        expect(text).not.toContain('<strong>');
    });

    it('needs every word, and ranks a title match first', () => {
        const hits = searchSections(SECTIONS, 'fast breathing');
        expect(hits.map((h) => h.section.id)).toEqual(['c', 'b']);
        expect(hits[1].snippet).toContain('Fast breathing');
    });

    it('finds nothing for words that are not there, or too short', () => {
        expect(searchSections(SECTIONS, 'malaria')).toEqual([]);
        expect(searchSections(SECTIONS, 'a')).toEqual([]);
    });

    it('matches Arabic however the letters were typed', () => {
        expect(fold('أطفال')).toBe(fold('اطفال'));
        expect(searchSections(SECTIONS, 'الاطفال').map((h) => h.section.id)).toEqual(['d']);
    });
});

describe('moved code still answers where it used to', () => {
    it('buildMigration is exported from courses.jsx', () => {
        const out = buildMigration({ course: { x: { course_key: 'k', course_title: 'IMNCI' } }, module: {}, section: {} }, 'k');
        expect(out.course.title).toBe('IMNCI');
    });
});

describe('reading time', () => {
    it('counts words at 150 a minute, plus time for videos and cases', async () => {
        const { readingMinutes } = await import('../src/components/imnci/onlineCourses/search');
        const words = Array.from({ length: 300 }, () => 'word').join(' ');
        expect(readingMinutes({ read: [{ type: 'paragraph', text: words }] })).toBe(2);
        expect(readingMinutes({ read: [{ type: 'paragraph', text: words }], practise: [{ type: 'exercise', exerciseId: 'x' }] })).toBe(4);
        expect(readingMinutes({ read: [{ type: 'paragraph', text: 'short' }] })).toBe(1);
        expect(readingMinutes({ read: [] })).toBe(0);
    });
});

describe('saving a module for offline', () => {
    it('lists each picture once, across tabs and old blocks', async () => {
        const { picturePaths } = await import('../src/components/imnci/onlineCourses/offline');
        const secs = [
            { read: [{ type: 'image', path: 'figures/a.png' }, { type: 'paragraph', text: 'x' }], see: [{ type: 'page', path: 'pages/p4.png' }] },
            { see: [{ type: 'page', path: 'pages/p4.png' }, { type: 'page', path: null }], blocks: [{ type: 'image', path: 'figures/b.png' }] },
        ];
        expect(picturePaths(secs).sort()).toEqual(['figures/a.png', 'figures/b.png', 'pages/p4.png']);
    });

    it('notices pictures added after a module was saved', async () => {
        const { offlineState } = await import('../src/components/imnci/onlineCourses/offline');
        const secs = [{ see: [{ type: 'page', path: 'pages/p4.png' }] }];
        expect(offlineState(null, secs)).toBe('none');
        expect(offlineState({ paths: ['online-courses/pages/p4.png'] }, secs)).toBe('saved');
        secs.push({ see: [{ type: 'page', path: 'pages/p5.png' }] });
        expect(offlineState({ paths: ['online-courses/pages/p4.png'] }, secs)).toBe('stale');
    });

    it('keeps a page another saved module still uses when one is removed', async () => {
        const store = new Map();
        globalThis.caches = {
            open: async () => ({
                match: async (k) => store.get(k),
                put: async (k, r) => { store.set(k, r); },
                delete: async (k) => store.delete(k),
            }),
        };
        const fileCache = await import('../src/components/imnci/onlineCourses/fileCache');
        const offline = await import('../src/components/imnci/onlineCourses/offline');
        await fileCache.putFile('online-courses/pages/p4.png', new Blob(['x']));
        await fileCache.putFile('online-courses/pages/p9.png', new Blob(['y']));
        localStorage.setItem('onlineCourseOffline', JSON.stringify({
            m1: { paths: ['online-courses/pages/p4.png', 'online-courses/pages/p9.png'] },
            m2: { paths: ['online-courses/pages/p4.png'] },
        }));
        await offline.removeModuleOffline('m1');
        expect(await fileCache.isFileCached('online-courses/pages/p4.png')).toBe(true);
        expect(await fileCache.isFileCached('online-courses/pages/p9.png')).toBe(false);
        expect(Object.keys(offline.savedModules())).toEqual(['m2']);
        delete globalThis.caches;
    });
});
