import { describe, it, expect } from 'vitest';
import { SSNB_CHECKLISTS, SKILLS_WARMER_USE, SKILLS_WARMER_CLEANING } from '../src/components/constants.js';

describe('portable warmer monitoring checklists', () => {
    it('offers two checklists, each with a label for every domain', () => {
        expect(Object.keys(SSNB_CHECKLISTS)).toEqual(['warmer_use', 'warmer_cleaning']);
        for (const c of Object.values(SSNB_CHECKLISTS)) {
            expect(c.domains.length).toBeGreaterThan(0);
            c.domains.forEach((d) => { expect(c.labels[d]).toBeTruthy(); expect(c.skills[d].length).toBeGreaterThan(0); });
        }
    });
    it('follows the national SOP', () => {
        const use = Object.values(SKILLS_WARMER_USE).flat().map((x) => x.text).join(' ');
        expect(use).toMatch(/30 minutes/);
        expect(use).toMatch(/Rainbow sign/);
        const clean = Object.values(SKILLS_WARMER_CLEANING).flat().map((x) => x.text).join(' ');
        expect(clean).toMatch(/0\.05% chlorine solution for 20 minutes/);
        expect(clean).toMatch(/distilled water/);
    });
});
