// textSearch (src/utils/textSearch.js): the guards behind the searchable
// dropdowns. A name/label stored as a number or not stored at all must
// never crash a screen — that is the v41.2 crash "n.label.toLowerCase is
// not a function" from Admin → Problems.
import { describe, it, expect } from 'vitest';
import { lowerText, textIncludes, textEquals } from '../src/utils/textSearch';

describe('lowerText', () => {
    it('lowercases strings as before', () => {
        expect(lowerText('Kassala Hospital')).toBe('kassala hospital');
        expect(lowerText('IMNCI')).toBe('imnci');
    });

    it('turns non-strings into text instead of throwing', () => {
        expect(lowerText(12345)).toBe('12345');
        expect(lowerText(true)).toBe('true');
    });

    it('turns missing values into empty text', () => {
        expect(lowerText(null)).toBe('');
        expect(lowerText(undefined)).toBe('');
    });
});

describe('textIncludes', () => {
    it('matches case-insensitively, as the dropdowns always did', () => {
        expect(textIncludes('Kassala Hospital', 'kass')).toBe(true);
        expect(textIncludes('Kassala Hospital', 'OMDURMAN')).toBe(false);
        expect(textIncludes('anything', '')).toBe(true);
    });

    it('survives the record that crashed the landing screen', () => {
        const options = [{ label: 'General Hospital' }, { label: 42 }, { label: null }, {}];
        const found = options.filter((o) => textIncludes(o.label, 'general'));
        expect(found).toEqual([{ label: 'General Hospital' }]);
        expect(options.filter((o) => textIncludes(o.label, '42'))).toEqual([{ label: 42 }]);
    });
});

describe('textEquals', () => {
    it('compares case-insensitively across types', () => {
        expect(textEquals('IMNCI', 'imnci')).toBe(true);
        expect(textEquals(2026, '2026')).toBe(true);
        expect(textEquals(null, '')).toBe(true);
        expect(textEquals('a', 'b')).toBe(false);
    });
});
