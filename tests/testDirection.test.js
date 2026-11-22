// Arabic pre/post tests read right to left whatever the app language is
// (src/components/CourseTestForm.jsx isArabicText / isArabicQuestionSet).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/data', () => ({}));
vi.mock('../src/data.js', () => ({}));

const load = () => import('../src/components/CourseTestForm.jsx');

describe('test direction', () => {
    it('Arabic question sets read right to left, English ones left to right', async () => {
        const m = await load();
        expect(m.isArabicQuestionSet(m.ETAT_TEST_QUESTIONS)).toBe(true);
        expect(m.isArabicQuestionSet(m.ICCM_TEST_QUESTIONS)).toBe(true);
        expect(m.isArabicQuestionSet(m.CPCM_TEST_QUESTIONS)).toBe(true);
        expect(m.isArabicQuestionSet(m.PROGRAM_MANAGEMENT_TEST_QUESTIONS)).toBe(true);
        expect(m.isArabicQuestionSet(m.SSNB_WARMER_TEST_QUESTIONS)).toBe(true);
        expect(m.isArabicQuestionSet(m.IMNCI_TEST_QUESTIONS)).toBe(false);
        expect(m.isArabicQuestionSet(m.EENC_TEST_QUESTIONS)).toBe(false);
        expect(m.isArabicQuestionSet(m.SSNB_SEPSIS_TEST_QUESTIONS)).toBe(false);
    });

    it('each question follows its own script', async () => {
        const m = await load();
        expect(m.isArabicText('1. ما هو العلاج المناسب؟ (ORS)')).toBe(true);
        expect(m.isArabicText('1. Which treatment is given?')).toBe(false);
        expect(m.isArabicText('')).toBe(false);
    }, 20000);
});
