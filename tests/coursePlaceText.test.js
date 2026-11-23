import { describe, it, expect } from 'vitest';
import { courseStateText, courseLocalityText, courseLocationText } from '../src/components/constants.js';

describe('course place text', () => {
    it('names a single state and locality', () => {
        expect(courseLocationText({ state: 'Khartoum', locality: 'Bahri' }, ' - ', 'en')).toBe('Khartoum - Bahri');
    });
    it('says "multiple" instead of listing names', () => {
        const c = { state: 'Khartoum, Northern', locality: 'Bahri, Dongola' };
        expect(courseStateText(c, 'en')).toBe('Multiple states');
        expect(courseLocalityText(c, 'en')).toBe('Multiple localities');
        expect(courseLocationText(c, ' - ', 'ar')).toBe('ولايات متعددة - محليات متعددة');
    });
    it('reads the arrays too, and one state with several localities', () => {
        const c = { states: ['Khartoum'], localities: ['Bahri', 'Karrari'] };
        expect(courseLocationText(c, ' / ', 'en')).toBe('Khartoum / Multiple localities');
    });
});
