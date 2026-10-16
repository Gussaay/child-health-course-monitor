import { describe, expect, it } from 'vitest';
import { addRecent, recentKey } from '../src/utils/recentPages';

describe('recently opened pages', () => {
    it('puts the newest page first and keeps one entry per page', () => {
        let list = [];
        list = addRecent(list, { page: { view: 'dashboard' } });
        list = addRecent(list, { page: { view: 'courses', tab: 'participants', course: 'c1' }, subtitle: 'IMNCI' });
        list = addRecent(list, { page: { view: 'dashboard' } });
        expect(list.map((e) => e.page.view)).toEqual(['dashboard', 'courses']);
    });

    it('treats different courses as different places', () => {
        const a = { view: 'courses', tab: 'participants', course: 'c1' };
        expect(recentKey(a)).not.toBe(recentKey({ ...a, course: 'c2' }));
    });

    it('keeps only the newest few', () => {
        let list = [];
        for (let i = 0; i < 10; i++) list = addRecent(list, { page: { view: 'courseReport', course: `c${i}` } }, 6);
        expect(list).toHaveLength(6);
        expect(list[0].page.course).toBe('c9');
    });
});
