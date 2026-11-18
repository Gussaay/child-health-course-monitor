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

    it('leaves any other address alone', async () => {
        const m = await load('/online-courses?oc=x');
        expect(window.location.pathname).toBe('/online-courses');
        expect(m.focusedCourseId()).toBeNull();
    });

    it('shares a live-site link, never the test address', async () => {
        const m = await load('/');
        expect(m.courseShareUrl('abc')).toBe('https://imnci-courses-monitor.web.app/learn/abc');
    });
});
