import { describe, it, expect } from 'vitest';
import { coverageColor, STATUS_COLORS } from '../src/utils/statusColors.js';

describe('coverageColor', () => {
    it('uses the no-data colour when there is no number', () => {
        expect(coverageColor(undefined)).toBe(STATUS_COLORS.none);
        expect(coverageColor(null)).toBe(STATUS_COLORS.none);
        expect(coverageColor(NaN)).toBe(STATUS_COLORS.none);
    });
    it('splits coverage at 40% and 75%', () => {
        expect(coverageColor(0)).toBe(STATUS_COLORS.poor);
        expect(coverageColor(39)).toBe(STATUS_COLORS.poor);
        expect(coverageColor(40)).toBe(STATUS_COLORS.partial);
        expect(coverageColor(74)).toBe(STATUS_COLORS.partial);
        expect(coverageColor(75)).toBe(STATUS_COLORS.good);
        expect(coverageColor(100)).toBe(STATUS_COLORS.good);
    });
});
