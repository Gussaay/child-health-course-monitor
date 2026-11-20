// The mentorship forms' mobile Save bar must stack ABOVE the view's
// MobileFormNavBar (h-16 = 4rem, z-40, fixed at bottom: var(--bottom-nav)).
// The old class, bottom-[var(--bottom-nav,4rem)], relied on a fallback that
// never applies — index.css always defines --bottom-nav (the measured
// credit-bar height) — so the Save bar landed in the nav bar's exact band
// at z-20 and was covered: on phones the skills form showed no Save button.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

describe('mentorship mobile save bars sit above the form nav bar', () => {
    it.each([
        '../src/components/mentorship/SkillsAssessmentForm.jsx',
        '../src/components/mentorship/IMNCIMothersForm.jsx',
    ])('%s offsets its mobile bar by the nav bar height', (path) => {
        const source = read(path);
        expect(source).toContain('bottom-[calc(var(--bottom-nav,0px)+4rem)]');
        expect(source).not.toContain('bottom-[var(--bottom-nav,4rem)]');
    });

    it('the nav bar they stack above is the 4rem one in SkillsMentorshipView', () => {
        const view = read('../src/components/mentorship/SkillsMentorshipView.jsx');
        expect(view).toContain('MobileFormNavBar');
        expect(view).toContain('bottom-[var(--bottom-nav,0px)]');
        expect(view).toContain('h-16');
    });
});
