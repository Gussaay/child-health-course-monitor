// problemCategories (src/utils/problemCategories.js): facility problems are
// sorted into categories from their own words, and statuses into three buckets.
import { describe, it, expect } from 'vitest';
import { categorizeProblem, statusBucket, summarizeProblems, normalizeText } from '../src/utils/problemCategories';

describe('categorizeProblem', () => {
    it('sorts Arabic and English problems', () => {
        expect(categorizeProblem('نقص في الأدوية خاصة الزنك')).toBe('medicines_supplies');
        expect(categorizeProblem('No ORS in stock')).toBe('medicines_supplies');
        expect(categorizeProblem('عدم وجود كادر مدرب')).toBe('staff_training');
        expect(categorizeProblem('Doctors not trained on IMNCI')).toBe('staff_training');
        expect(categorizeProblem('لا يوجد ميزان ولا ترمومتر')).toBe('equipment');
        expect(categorizeProblem('انقطاع الكهرباء والمياه')).toBe('infrastructure');
        expect(categorizeProblem('عدم توفر استمارات التسجيل')).toBe('records_reporting');
        expect(categorizeProblem('صعوبة الترحيل وعدم وجود وقود')).toBe('funding_logistics');
        expect(categorizeProblem('قلة وعي الأمهات')).toBe('community');
        expect(categorizeProblem('شيء آخر')).toBe('other');
        expect(categorizeProblem('')).toBe('other');
    });

    it('does not match a keyword inside another word', () => {
        expect(categorizeProblem('doctors absent')).toBe('staff_training'); // not "ors"
        expect(categorizeProblem('ذكرت المشرفة')).toBe('other'); // not "كرت"
    });

    it('folds Arabic spellings', () => {
        expect(normalizeText('الأدوية')).toBe(normalizeText('الادويه'));
    });
});

describe('statusBucket and summary', () => {
    it('buckets statuses', () => {
        expect(statusBucket('Pending')).toBe('pending');
        expect(statusBucket(undefined)).toBe('pending');
        expect(statusBucket('In Progress')).toBe('in_progress');
        expect(statusBucket('Resolved')).toBe('resolved');
        expect(statusBucket('Done')).toBe('resolved');
        expect(statusBucket('Resolved/Done')).toBe('resolved');
    });

    it('summarizes by status and category, largest first', () => {
        const s = summarizeProblems([
            { problem: 'نقص الأدوية', status: 'Pending' },
            { problem: 'No zinc', status: 'Resolved' },
            { problem: 'كادر غير مدرب', status: 'In Progress' },
            { problem: '   ', status: 'Pending' },
        ]);
        expect(s.total).toBe(3);
        expect(s.byStatus).toEqual({ pending: 1, in_progress: 1, resolved: 1 });
        expect(s.resolvedPct).toBe(33.3);
        expect(s.categories[0]).toMatchObject({ key: 'medicines_supplies', total: 2, resolved: 1, resolvedPct: 50 });
        expect(summarizeProblems([]).resolvedPct).toBe(null);
    });
});

// The server sorts problems for the public link with a CommonJS copy
// (functions/problemCategoriesCore.js). The two must never disagree.
import { createRequire } from 'node:module';
import * as app from '../src/utils/problemCategories';
const server = createRequire(import.meta.url)('../functions/problemCategoriesCore.js');

describe('server copy of the categorizer', () => {
    it('has the same categories, keywords and statuses', () => {
        expect(server.PROBLEM_CATEGORIES).toEqual(app.PROBLEM_CATEGORIES);
        expect(server.OTHER_CATEGORY).toEqual(app.OTHER_CATEGORY);
        expect(server.STATUS_BUCKETS).toEqual(app.STATUS_BUCKETS);
    });
    it('gives the same answers', () => {
        const texts = ['نقص في الأدوية', 'No ORS', 'كادر غير مدرب', 'doctors absent', 'انقطاع الكهرباء', 'استمارات', 'وقود', 'وعي الأمهات', 'ذكرت', '', 'random'];
        texts.forEach((x) => expect(server.categorizeProblem(x)).toBe(app.categorizeProblem(x)));
        ['Pending', 'In Progress', 'Done', 'Resolved/Done', undefined].forEach((x) => expect(server.statusBucket(x)).toBe(app.statusBucket(x)));
    });
});
