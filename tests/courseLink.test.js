import { describe, it, expect, beforeEach, vi } from 'vitest';

// The course link is read once, when the module loads, so each case loads a
// fresh copy after setting the address.
async function load(path) {
    vi.resetModules();
    window.history.replaceState(null, '', path);
    return import('../src/utils/courseLink.js');
}

describe('shared course link', () => {
    beforeEach(() => sessionStorage.clear());

    it('turns /learn/<id> into the Online Courses address and remembers the course', async () => {
        const m = await load('/learn/abc_123');
        expect(window.location.pathname).toBe('/online-courses');
        expect(new URLSearchParams(window.location.search).get('oc')).toBe('abc_123');
        expect(m.focusedCourseId()).toBe('abc_123');
        m.clearFocusedCourse();
        expect(m.focusedCourseId()).toBeNull();
    });

    it('opens one module or one lesson from a module or lesson link', async () => {
        const m = await load('/learn/c1/m2');
        const q = new URLSearchParams(window.location.search);
        expect([q.get('oc'), q.get('mod'), q.get('sec')]).toEqual(['c1', 'm2', null]);
        expect(m.focusedCourseId()).toBe('c1');
        await load('/learn/c1/m2/s3/');
        const r = new URLSearchParams(window.location.search);
        expect([r.get('oc'), r.get('mod'), r.get('sec')]).toEqual(['c1', 'm2', 's3']);
    });

    it('leaves any other address alone', async () => {
        const m = await load('/online-courses?oc=x');
        expect(window.location.pathname).toBe('/online-courses');
        expect(m.focusedCourseId()).toBeNull();
    });

    it('shares a live-site link, never the test address', async () => {
        await load('/');
        const { courseShareUrl } = await import('../src/utils/courseShare.js');
        expect(courseShareUrl('abc')).toBe('https://imnci-courses-monitor.web.app/learn/abc');
        expect(courseShareUrl('abc', 'm1')).toBe('https://imnci-courses-monitor.web.app/learn/abc/m1');
        expect(courseShareUrl('abc', 'm1', 's1')).toBe('https://imnci-courses-monitor.web.app/learn/abc/m1/s1');
        expect(courseShareUrl('abc', null, 's1')).toBe('https://imnci-courses-monitor.web.app/learn/abc');
    });
});
