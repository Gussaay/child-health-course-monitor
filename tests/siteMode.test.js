import { describe, it, expect } from 'vitest';
import { hiddenViewsFor, siteModulesFor, SITE_MODULES } from '../src/siteMode';

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
