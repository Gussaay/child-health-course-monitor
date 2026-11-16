import { describe, it, expect } from 'vitest';
import { weightForHeight } from '../src/components/imnci/whz';

describe('weight-for-height z-score on the recording form', () => {
    it('reads a weight below the -3 line as "Less than -3Z"', () => {
        // Noah, Module 6: 12.7 kg at 104 cm, where the -3 line is 13.0 kg.
        expect(weightForHeight({ sex: 'male', ageMonths: 28, weightKg: 12.7, lengthCm: 104 }).status).toBe('Less than -3Z');
        expect(weightForHeight({ sex: 'male', ageMonths: 28, weightKg: 10.2, lengthCm: 107 }).status).toBe('Less than -3Z');
    });

    it('keeps a weight on the -3 line, or between -3 and -2, as moderate', () => {
        expect(weightForHeight({ sex: 'male', ageMonths: 28, weightKg: 13.0, lengthCm: 104 }).status).toBe('Between -3 and -2 Z');
        expect(weightForHeight({ sex: 'male', ageMonths: 26, weightKg: 9.3, lengthCm: 83 }).status).toBe('Between -3 and -2 Z');
    });

    it('reads a normal weight as -2 Z or more, and says when data is missing', () => {
        expect(weightForHeight({ sex: 'female', ageMonths: 24, weightKg: 13, lengthCm: 85 }).status).toBe('-2 Z or more');
        expect(weightForHeight({ sex: 'female', ageMonths: 24, weightKg: 13 }).status).toBe('Incomplete Data');
    });
});
