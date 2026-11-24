// src/dashboards/serverCopy.js
//
// Fetches one list from a paged server copy (functions/pagedLists.js): the
// manifest, then its pages a few at a time. A list that moves on while its
// pages arrive is fetched again (at most twice). Throws on any failure; the
// caller then reads the database as before.
import { getFunctions, httpsCallable } from 'firebase/functions';

export async function fetchPagedList({ manifestOf, fetchPage, list, parallel = 4 }) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const m = (await manifestOf([list]))?.[list];
        if (!m || !(m.pages >= 1)) throw new Error(`The server copy has no ${list}.`);
        const pages = new Array(m.pages);
        let next = 0;
        let stale = false;
        const worker = async () => {
            while (next < pages.length && !stale) {
                const i = next++;
                const res = await fetchPage(list, i, m.version);
                if (res?.stale) { stale = true; return; }
                if (!Array.isArray(res?.items)) throw new Error(res?.error || 'The server copy could not be read.');
                pages[i] = res.items;
            }
        };
        await Promise.all(Array.from({ length: Math.min(parallel, pages.length) }, worker));
        if (!stale) return [].concat(...pages);
    }
    throw new Error('The server copy kept changing while it loaded.');
}

/** One mentorship list (skillMentorshipSubmissions, imnciVisitReports, eencVisitReports) from the server copy. */
export async function fetchMentorshipCopyList(list) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
    const call = httpsCallable(getFunctions(), 'mentorshipCopy', { timeout: 240000 });
    return fetchPagedList({
        list,
        manifestOf: async (lists) => (await call({ lists }))?.data,
        fetchPage: async (name, page, version) => (await call({ list: name, page, version }))?.data,
    });
}
