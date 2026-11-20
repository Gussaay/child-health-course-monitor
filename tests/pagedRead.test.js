// readAllPages (src/utils/pagedRead.js): the paged download behind
// listHealthFacilities. The point of these tests is the guarantee the
// Dashboard's fallback path depends on: paging a list changes how it
// travels, never what arrives — every item, in order, nothing dropped.
import { describe, it, expect, vi } from 'vitest';
import { readAllPages, DEFAULT_PAGE_SIZE } from '../src/utils/pagedRead';

// A fetchPage stand-in over a plain array: the cursor is the last item of
// the previous page, as a Firestore document snapshot would be.
const over = (all) => async (cursor, pageSize) => {
    const start = cursor == null ? 0 : all.indexOf(cursor) + 1;
    return all.slice(start, start + pageSize);
};

describe('readAllPages', () => {
    it('returns a short list in one page', async () => {
        const fetchPage = vi.fn(over([1, 2, 3]));
        await expect(readAllPages(fetchPage, { pageSize: 500 })).resolves.toEqual([1, 2, 3]);
        expect(fetchPage).toHaveBeenCalledTimes(1);
        expect(fetchPage).toHaveBeenCalledWith(null, 500);
    });

    it('walks every page and returns all items in order', async () => {
        const all = Array.from({ length: 1250 }, (_, i) => i + 1);
        const fetchPage = vi.fn(over(all));
        await expect(readAllPages(fetchPage, { pageSize: 500 })).resolves.toEqual(all);
        expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([null, 500, 1000]);
    });

    it('ends an exact multiple with one empty page, dropping nothing', async () => {
        const all = Array.from({ length: 1000 }, (_, i) => i + 1);
        const fetchPage = vi.fn(over(all));
        await expect(readAllPages(fetchPage, { pageSize: 500 })).resolves.toEqual(all);
        expect(fetchPage).toHaveBeenCalledTimes(3);
    });

    it('returns an empty list from an empty first page', async () => {
        await expect(readAllPages(over([]), { pageSize: 10 })).resolves.toEqual([]);
    });

    it('uses the default page size when none is given', async () => {
        const fetchPage = vi.fn(over([1]));
        await readAllPages(fetchPage);
        expect(fetchPage).toHaveBeenCalledWith(null, DEFAULT_PAGE_SIZE);
    });

    it('propagates a failed page instead of returning a partial list', async () => {
        const fetchPage = vi.fn()
            .mockResolvedValueOnce([1, 2])
            .mockRejectedValueOnce(new Error('page 2 failed'));
        await expect(readAllPages(fetchPage, { pageSize: 2 })).rejects.toThrow('page 2 failed');
    });

    it('rejects a page that is not an array', async () => {
        await expect(readAllPages(async () => null, { pageSize: 2 })).rejects.toThrow(TypeError);
    });

    it('rejects a bad page size before fetching anything', async () => {
        const fetchPage = vi.fn(over([1]));
        await expect(readAllPages(fetchPage, { pageSize: 0 })).rejects.toThrow(RangeError);
        expect(fetchPage).not.toHaveBeenCalled();
    });
});
