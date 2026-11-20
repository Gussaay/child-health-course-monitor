// src/utils/pagedRead.js
//
// Read a list in pages and return every item, in the order the pages gave
// them. Used first for the health facilities list (src/data.js,
// listHealthFacilities): one query for the whole collection could take
// minutes on a slow phone connection and, when it timed out, left the
// device with an empty or partial list. Reading a page at a time keeps
// each request small, and a page that fails is an error the caller sees,
// not a list that silently ends early.
//
// This helper knows nothing about Firestore. The caller supplies
// `fetchPage(cursor, pageSize)`, which must return the page's items as an
// array; `cursor` is null for the first page and the last item of the
// previous page after that (for Firestore that item is the document
// snapshot, which `startAfter()` accepts). A page with fewer items than
// `pageSize` is the last page. A list whose size is an exact multiple of
// the page size therefore costs one extra, empty page — one read if the
// page is a Firestore query that returns nothing.
//
// Nothing here drops, reorders or deduplicates items: callers that need
// the complete list (including the Dashboard's fallback path, which uses
// the full facilities list when its slim server copy cannot be had) get
// exactly the items a single unpaged read would have given them.

export const DEFAULT_PAGE_SIZE = 500;

export async function readAllPages(fetchPage, { pageSize = DEFAULT_PAGE_SIZE } = {}) {
    if (typeof fetchPage !== 'function') {
        throw new TypeError('readAllPages: fetchPage must be a function');
    }
    if (!Number.isInteger(pageSize) || pageSize <= 0) {
        throw new RangeError(`readAllPages: pageSize must be a positive integer, got ${pageSize}`);
    }

    const items = [];
    let cursor = null;
    for (;;) {
        const page = await fetchPage(cursor, pageSize);
        if (!Array.isArray(page)) {
            throw new TypeError('readAllPages: fetchPage must return an array');
        }
        items.push(...page);
        if (page.length < pageSize) return items;
        const nextCursor = page[page.length - 1];
        if (nextCursor == null || nextCursor === cursor) {
            throw new Error('readAllPages: page cursor did not advance');
        }
        cursor = nextCursor;
    }
}
