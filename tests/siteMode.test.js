import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hiddenViewsFor, siteModulesFor, SITE_MODULES, MAIN_SITE_ONLY_VIEWS } from '../src/siteMode';

describe('site modules', () => {
    it('main site hides nothing', () => {
        expect(hiddenViewsFor('main', null).size).toBe(0);
    });

    it('ch-sudan defaults to dashboard and online courses', () => {
        const hidden = hiddenViewsFor('ch', null);
        expect(hidden.has('dashboard')).toBe(false);
        expect(hidden.has('onlineCourses')).toBe(false);
        expect(hidden.has('landing')).toBe(false);
        ['courses', 'courseReport', 'humanResources', 'facilitatorForm', 'admin', 'imciForm', 'meetings'].forEach(v => expect(hidden.has(v)).toBe(true));
    });

    it('EmONC defaults to courses and surveys', () => {
        const hidden = hiddenViewsFor('emonc', null);
        ['courses', 'participants', 'observe', 'survey'].forEach(v => expect(hidden.has(v)).toBe(false));
        ['dashboard', 'onlineCourses', 'admin', 'imciForm'].forEach(v => expect(hidden.has(v)).toBe(true));
    });

    it('uses the saved choice and ignores unknown modules', () => {
        const settings = { sites: { ch: { modules: ['courses', 'nope'] } } };
        expect(siteModulesFor('ch', settings)).toEqual(['courses']);
        const hidden = hiddenViewsFor('ch', settings);
        expect(hidden.has('courseReport')).toBe(false);
        expect(hidden.has('dashboard')).toBe(true);
    });

    it('an empty saved list hides every module, except Online Courses on ch-sudan', () => {
        const hidden = hiddenViewsFor('ch', { sites: { ch: { modules: [] } } });
        SITE_MODULES.filter(m => m.id !== 'onlineCourses').forEach(m => expect(hidden.has(m.id)).toBe(true));
        expect(hidden.has('onlineCourses')).toBe(false);
        expect(hiddenViewsFor('emonc', { sites: { emonc: { modules: [] } } }).has('onlineCourses')).toBe(true);
    });
});

describe('every module the app has is classified for sites', () => {
    it('library and mentorship dashboard are hidden unless a site chooses them', () => {
        ['ch', 'emonc'].forEach(site => {
            const hidden = hiddenViewsFor(site, null);
            expect(hidden.has('library')).toBe(true);
            expect(hidden.has('mentorshipDashboard')).toBe(true);
        });
        const settings = { sites: { ch: { modules: ['library'] }, emonc: { modules: ['mentorshipDashboard'] } } };
        expect(hiddenViewsFor('ch', settings).has('library')).toBe(false);
        expect(hiddenViewsFor('ch', settings).has('mentorshipDashboard')).toBe(true);
        expect(hiddenViewsFor('emonc', settings).has('mentorshipDashboard')).toBe(false);
        expect(siteModulesFor('emonc', settings)).toEqual(['mentorshipDashboard']);
    });

    // Admin > Sites renders SITE_MODULES, so a module tile that is missing
    // from it would show on every site with no way to manage it. Scan the
    // tile and nav definitions in App.jsx and require each view to be
    // classified: in a module, main-site-only, or always shown (the home
    // page and the public link pages).
    it('no module tile or nav view in App.jsx is missing from SITE_MODULES', () => {
        // vitest runs under jsdom here, where import.meta.url is an http URL
        // rather than a file URL, so fall back to the repo root when needed.
        let appPath;
        try {
            appPath = fileURLToPath(new URL('../src/App.jsx', import.meta.url));
        } catch {
            appPath = resolve(process.cwd(), 'src/App.jsx');
        }
        const app = readFileSync(appPath, 'utf8');
        const region = (from, to) => {
            const a = app.indexOf(from);
            const b = app.indexOf(to, a);
            expect(a).toBeGreaterThan(-1);
            expect(b).toBeGreaterThan(a);
            return app.slice(a, b);
        };
        const views = new Set();
        [region('function allModules', 'COVERAGE_ITEMS'), region('const navItems', 'visibleNavItems')]
            .forEach(text => [...text.matchAll(/view: '([A-Za-z]+)'/g)].forEach(m => views.add(m[1])));
        expect(views.size).toBeGreaterThan(15);
        const classified = new Set(['landing', ...MAIN_SITE_ONLY_VIEWS]);
        SITE_MODULES.forEach(m => m.views.forEach(v => classified.add(v)));
        [...views].forEach(v => expect(classified.has(v), `view '${v}' is not classified in siteMode.js`).toBe(true));
    });
});
